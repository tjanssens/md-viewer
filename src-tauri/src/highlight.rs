//! Code highlighting with syntect. The syntax set is loaded lazily (and can be
//! pre-warmed on a background thread) so it never delays the first paint.

use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

use syntect::highlighting::ThemeSet;
use syntect::html::{css_for_theme_with_class_style, ClassStyle, ClassedHTMLGenerator};
use syntect::parsing::{SyntaxReference, SyntaxSet};
use syntect::util::LinesWithEndings;

const STYLE: ClassStyle = ClassStyle::SpacedPrefixed { prefix: "hl-" };
/// Code blocks bigger than this are shown without colours.
const MAX_CODE: usize = 256 * 1024;
const CACHE_LIMIT: usize = 2000;

fn syntaxes() -> &'static SyntaxSet {
    static S: OnceLock<SyntaxSet> = OnceLock::new();
    S.get_or_init(SyntaxSet::load_defaults_newlines)
}

fn cache() -> &'static Mutex<HashMap<u64, Option<String>>> {
    static C: OnceLock<Mutex<HashMap<u64, Option<String>>>> = OnceLock::new();
    C.get_or_init(|| Mutex::new(HashMap::new()))
}

pub fn prewarm() {
    let _ = syntaxes();
}

fn find_syntax<'a>(ss: &'a SyntaxSet, lang: &str) -> Option<&'a SyntaxReference> {
    let lang = lang.trim().to_ascii_lowercase();
    if lang.is_empty() {
        return None;
    }
    let alias = match lang.as_str() {
        "ts" | "typescript" | "tsx" | "jsx" | "mjs" | "cjs" | "javascript" | "node" => "js",
        "sh" | "shell" | "zsh" | "console" | "shellscript" | "bash" => "bash",
        "yml" => "yaml",
        "py" | "python3" => "py",
        "c++" | "hpp" => "cpp",
        "cs" | "csharp" | "c#" => "cs",
        "svg" => "xml",
        "toml" | "ini" | "cfg" => "ini",
        "golang" => "go",
        "md" | "markdown" => "md",
        "ps1" | "powershell" | "bat" | "cmd" => "bat",
        other => other,
    };
    ss.find_syntax_by_token(alias).or_else(|| ss.find_syntax_by_extension(alias))
}

/// Returns highlighted inner HTML for a `<code>` element, or None when the
/// language is unknown.
pub fn highlight(lang: &str, code: &str) -> Option<String> {
    if code.len() > MAX_CODE {
        return None;
    }
    let mut key = crate::render::fnv1a(code.as_bytes());
    key ^= crate::render::fnv1a(lang.as_bytes()).rotate_left(17);
    if let Some(hit) = cache().lock().unwrap().get(&key) {
        return hit.clone();
    }
    let ss = syntaxes();
    let result = find_syntax(ss, lang).and_then(|syntax| {
        let mut gen = ClassedHTMLGenerator::new_with_class_style(syntax, ss, STYLE);
        for line in LinesWithEndings::from(code) {
            gen.parse_html_for_line_which_includes_newline(line).ok()?;
        }
        Some(gen.finalize())
    });
    let mut c = cache().lock().unwrap();
    if c.len() > CACHE_LIMIT {
        c.clear();
    }
    c.insert(key, result.clone());
    result
}

/// Prefix every selector of a stylesheet with `scope `.
fn scope_css(css: &str, scope: &str) -> String {
    let mut out = String::with_capacity(css.len() * 2);
    let mut in_comment = false;
    for line in css.lines() {
        let l = line.trim();
        if in_comment {
            if l.contains("*/") {
                in_comment = false;
            }
            continue;
        }
        if l.starts_with("/*") {
            in_comment = !l.contains("*/");
            continue;
        }
        if l.ends_with('{') {
            let sel = l.trim_end_matches('{');
            let scoped: Vec<String> = sel
                .split(',')
                .map(|s| s.trim())
                .filter(|s| !s.is_empty())
                .map(|s| format!("{scope} {s}"))
                .collect();
            out.push_str(&scoped.join(", "));
            out.push_str(" {\n");
        } else if !l.starts_with("background-color") {
            out.push_str(line);
            out.push('\n');
        }
    }
    out
}

/// CSS for both themes, scoped to `body.theme-light` / `body.theme-dark`.
pub fn css() -> String {
    let ts = ThemeSet::load_defaults();
    let mut out = String::new();
    for (scope, name) in [("body.theme-light", "InspiredGitHub"), ("body.theme-dark", "base16-ocean.dark")] {
        if let Some(theme) = ts.themes.get(name) {
            if let Ok(css) = css_for_theme_with_class_style(theme, STYLE) {
                out.push_str(&scope_css(&css, scope));
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn highlights_known_languages() {
        let h = highlight("rust", "fn main() {}\n").unwrap();
        assert!(h.contains("hl-"));
        assert!(highlight("ts", "const x = 1;\n").is_some());
        assert!(highlight("nope-lang", "x").is_none());
    }

    #[test]
    fn css_is_scoped() {
        let c = css();
        assert!(c.contains("body.theme-light .hl-"));
        assert!(c.contains("body.theme-dark .hl-"));
    }
}
