//! Markdown -> list of top-level HTML blocks.
//!
//! The document is parsed once as a whole (so reference links etc. resolve),
//! then every top-level node is rendered on its own. Each block gets a stable
//! id derived from a hash of its HTML, so the frontend only has to touch the
//! DOM for blocks whose id it has not seen before.

use std::collections::{HashMap, HashSet};
use std::path::Path;
use std::sync::{Arc, OnceLock};

use comrak::nodes::{AstNode, NodeValue};
use comrak::{format_html, parse_document, Anchorizer, Arena, Options};
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct Block {
    /// Stable id: hash of the HTML plus occurrence index.
    pub id: String,
    /// First source line (1-based) of this block.
    pub line: u32,
    /// The HTML; omitted when the frontend already has this block.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub html: Option<String>,
    /// Heading level (1..=6) when the block is a heading.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub h: Option<u8>,
    /// Heading text when the block is a heading.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub t: Option<String>,
}

fn options(base_dir: Option<&Path>) -> Options<'static> {
    let mut o = Options::default();
    o.extension.strikethrough = true;
    o.extension.table = true;
    o.extension.autolink = true;
    o.extension.tasklist = true;
    o.extension.alerts = true;
    o.extension.front_matter_delimiter = Some("---".to_string());
    // Match the old viewer (marked with `breaks: true`).
    o.render.hardbreaks = true;
    // Raw HTML is allowed but every block that contains any is sanitised.
    o.render.unsafe_ = true;
    if let Some(dir) = base_dir {
        let dir = dir.to_path_buf();
        o.extension.image_url_rewriter = Some(Arc::new(move |url: &str| rewrite_image(&dir, url)));
    }
    o
}

/// Relative image paths are resolved against the document folder and served
/// through Tauri's asset protocol.
fn rewrite_image(dir: &Path, url: &str) -> String {
    if url.is_empty()
        || url.starts_with('#')
        || url.contains("://")
        || url.starts_with("data:")
        || url.starts_with("//")
    {
        return url.to_string();
    }
    let raw = url.split(['?', '#']).next().unwrap_or(url);
    let decoded = percent_decode(raw);
    let p = Path::new(&decoded);
    let full = if p.is_absolute() { p.to_path_buf() } else { dir.join(p) };
    asset_url(&full.to_string_lossy())
}

pub fn asset_url(path: &str) -> String {
    let enc = percent_encode(path);
    if cfg!(windows) {
        format!("http://asset.localhost/{enc}")
    } else {
        format!("asset://localhost/{enc}")
    }
}

fn percent_encode(s: &str) -> String {
    let mut out = String::with_capacity(s.len() * 3);
    for b in s.bytes() {
        if b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.' | b'~') {
            out.push(b as char);
        } else {
            out.push_str(&format!("%{b:02X}"));
        }
    }
    out
}

fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(v) = u8::from_str_radix(&s[i + 1..i + 3], 16) {
                out.push(v);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

pub fn fnv1a(data: &[u8]) -> u64 {
    let mut h: u64 = 0xcbf29ce484222325;
    for b in data {
        h ^= *b as u64;
        h = h.wrapping_mul(0x100000001b3);
    }
    h
}

fn sanitizer() -> &'static ammonia::Builder<'static> {
    static S: OnceLock<ammonia::Builder<'static>> = OnceLock::new();
    S.get_or_init(|| {
        let mut b = ammonia::Builder::default();
        b.add_tags(["input", "details", "summary", "kbd", "mark", "ins", "del", "sup", "sub", "u"]);
        b.add_tag_attributes("input", ["type", "checked", "disabled"]);
        b.add_tag_attributes("img", ["width", "height", "align"]);
        b.add_generic_attributes(["class", "align", "id", "title", "open"]);
        b.add_url_schemes(["asset"]);
        b
    })
}

const VOID_TAGS: &[&str] = &[
    "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr",
];

/// Net number of opened-but-not-closed elements in an HTML fragment. Used to
/// keep `<details> ... markdown ... </details>` together in one block.
fn html_depth_delta(s: &str) -> i32 {
    let b = s.as_bytes();
    let mut depth = 0;
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'<' && i + 1 < b.len() {
            let closing = b[i + 1] == b'/';
            let start = if closing { i + 2 } else { i + 1 };
            let mut j = start;
            while j < b.len() && (b[j].is_ascii_alphanumeric() || b[j] == b'-') {
                j += 1;
            }
            if j > start && b[start].is_ascii_alphabetic() {
                let name = s[start..j].to_ascii_lowercase();
                // find end of tag
                let mut k = j;
                while k < b.len() && b[k] != b'>' {
                    k += 1;
                }
                let self_closing = k > 0 && k < b.len() && b[k - 1] == b'/';
                if !VOID_TAGS.contains(&name.as_str()) && !self_closing {
                    depth += if closing { -1 } else { 1 };
                }
                i = k;
                continue;
            }
        }
        i += 1;
    }
    depth
}

fn contains_raw_html<'a>(node: &'a AstNode<'a>) -> bool {
    node.descendants().any(|n| {
        matches!(n.data.borrow().value, NodeValue::HtmlBlock(_) | NodeValue::HtmlInline(_))
    })
}

fn collect_text<'a>(node: &'a AstNode<'a>, out: &mut String) {
    for n in node.descendants() {
        match &n.data.borrow().value {
            NodeValue::Text(t) => out.push_str(t),
            NodeValue::Code(c) => out.push_str(&c.literal),
            NodeValue::LineBreak | NodeValue::SoftBreak => out.push(' '),
            _ => {}
        }
    }
}

/// Render a full document into blocks (all with HTML).
pub fn render_blocks(text: &str, base_dir: Option<&Path>) -> Vec<Block> {
    let opts = options(base_dir);
    let arena = Arena::new();
    let root = parse_document(&arena, text, &opts);
    let mut anchorizer = Anchorizer::new();

    let mut blocks: Vec<Block> = Vec::new();
    let mut seen: HashMap<u64, u32> = HashMap::new();

    let children: Vec<_> = root.children().collect();
    let mut i = 0;
    while i < children.len() {
        let first = children[i];
        let line = first.data.borrow().sourcepos.start.line as u32;
        if matches!(first.data.borrow().value, NodeValue::FrontMatter(_)) {
            i += 1;
            continue;
        }
        // Group nodes while an HTML block left elements open.
        let mut group = vec![first];
        let mut depth = match &first.data.borrow().value {
            NodeValue::HtmlBlock(h) => html_depth_delta(&h.literal),
            _ => 0,
        };
        while depth > 0 && i + 1 < children.len() {
            i += 1;
            let n = children[i];
            if let NodeValue::HtmlBlock(h) = &n.data.borrow().value {
                depth += html_depth_delta(&h.literal);
            }
            group.push(n);
        }
        i += 1;

        let mut html = Vec::new();
        let mut raw = false;
        for n in &group {
            let _ = format_html(n, &opts, &mut html);
            raw |= contains_raw_html(n);
        }
        let mut html = String::from_utf8(html).unwrap_or_default();
        if raw {
            html = sanitizer().clean(&html).to_string();
        }

        let mut h = None;
        let mut t = None;
        if group.len() == 1 {
            if let NodeValue::Heading(nh) = &first.data.borrow().value {
                let mut s = String::new();
                collect_text(first, &mut s);
                let s = s.trim().to_string();
                let slug = anchorizer.anchorize(s.clone());
                let open = format!("<h{}>", nh.level);
                if html.starts_with(&open) {
                    html = format!("<h{} id=\"{}\">{}", nh.level, slug, &html[open.len()..]);
                }
                h = Some(nh.level);
                t = Some(s);
            }
        }

        let hash = fnv1a(html.as_bytes());
        let occ = seen.entry(hash).or_insert(0);
        let id = format!("{hash:x}-{occ}");
        *occ += 1;
        blocks.push(Block { id, line, html: Some(html), h, t });
    }
    blocks
}

/// Drop the HTML of blocks the frontend already has and remember the new set.
pub fn strip_known(blocks: &mut [Block], known: &mut HashSet<String>, reset: bool) {
    if reset {
        known.clear();
    }
    let mut next = HashSet::with_capacity(blocks.len());
    for b in blocks.iter_mut() {
        if known.contains(&b.id) {
            b.html = None;
        }
        next.insert(b.id.clone());
    }
    *known = next;
}

#[cfg(test)]
mod tests {
    use super::*;

    fn html(md: &str) -> String {
        render_blocks(md, None).into_iter().map(|b| b.html.unwrap()).collect()
    }

    #[test]
    fn splits_top_level_blocks() {
        let b = render_blocks("# Title\n\nPara one\n\n- a\n- b\n", None);
        assert_eq!(b.len(), 3);
        assert_eq!(b[0].h, Some(1));
        assert_eq!(b[0].t.as_deref(), Some("Title"));
        assert_eq!(b[0].line, 1);
        assert_eq!(b[1].line, 3);
        assert!(b[0].html.as_ref().unwrap().starts_with("<h1 id=\"title\">"));
    }

    #[test]
    fn gfm_features() {
        let h = html("| a | b |\n|---|---|\n| 1 | 2 |\n\n~~x~~ https://example.com\n\n- [x] done\n");
        assert!(h.contains("<table>"));
        assert!(h.contains("<del>x</del>"));
        assert!(h.contains("href=\"https://example.com\""));
        assert!(h.contains("checkbox"));
    }

    #[test]
    fn soft_breaks_are_hard() {
        assert!(html("a\nb").contains("<br"));
    }

    #[test]
    fn duplicate_blocks_get_unique_ids() {
        let b = render_blocks("same\n\nsame\n", None);
        assert_ne!(b[0].id, b[1].id);
    }

    #[test]
    fn duplicate_headings_get_unique_slugs() {
        let h = html("# A\n\n# A\n");
        assert!(h.contains("id=\"a\""));
        assert!(h.contains("id=\"a-1\""));
    }

    #[test]
    fn scripts_are_stripped() {
        let h = html("<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\nok <b onclick=x>b</b>");
        assert!(!h.contains("<script"));
        assert!(!h.contains("onerror"));
        assert!(!h.contains("onclick"));
        assert!(h.contains("<b>b</b>"));
    }

    #[test]
    fn details_stay_in_one_block() {
        let b = render_blocks("<details>\n<summary>S</summary>\n\nInner **md**\n\n</details>\n\nafter\n", None);
        assert_eq!(b.len(), 2);
        let h = b[0].html.as_ref().unwrap();
        assert!(h.contains("<details>") && h.contains("</details>") && h.contains("<strong>md</strong>"));
    }

    #[test]
    fn front_matter_hidden() {
        let b = render_blocks("---\ntitle: x\n---\n\n# Hi\n", None);
        assert_eq!(b.len(), 1);
        assert_eq!(b[0].h, Some(1));
    }

    #[test]
    fn relative_images_use_asset_protocol() {
        let b = render_blocks("![a](img/x%20y.png) ![b](https://e.com/b.png)", Some(Path::new("/docs")));
        let h = b[0].html.as_ref().unwrap();
        assert!(h.contains("localhost/%2Fdocs%2Fimg%2Fx%20y.png"), "{h}");
        assert!(h.contains("https://e.com/b.png"));
    }

    #[test]
    fn strip_known_only_sends_new_html() {
        let mut known = HashSet::new();
        let mut a = render_blocks("one\n\ntwo\n", None);
        strip_known(&mut a, &mut known, true);
        assert!(a.iter().all(|b| b.html.is_some()));
        let mut b = render_blocks("one\n\ntwo changed\n", None);
        strip_known(&mut b, &mut known, false);
        assert!(b[0].html.is_none());
        assert!(b[1].html.is_some());
    }

    #[test]
    fn depth_delta() {
        assert_eq!(html_depth_delta("<details><summary>x</summary>"), 1);
        assert_eq!(html_depth_delta("<br><img src=x/><hr/>"), 0);
        assert_eq!(html_depth_delta("</details>"), -1);
    }
}

#[cfg(test)]
mod bench {
    /// `MDV_BENCH=file.md cargo test --release bench_render -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn bench_render() {
        let path = std::env::var("MDV_BENCH").expect("MDV_BENCH");
        let text = std::fs::read_to_string(path).unwrap();
        let t = std::time::Instant::now();
        let blocks = super::render_blocks(&text, None);
        let first = t.elapsed();
        let t = std::time::Instant::now();
        for _ in 0..10 {
            super::render_blocks(&text, None);
        }
        println!("{} bytes, {} blocks, first {:?}, avg {:?}", text.len(), blocks.len(), first, t.elapsed() / 10);
    }
}
