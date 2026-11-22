//! Feedback annotations are stored per document in the app data folder,
//! one small JSON file per document path.

use std::fs;
use std::path::{Path, PathBuf};

use serde_json::{json, Value};

fn file_for(dir: &Path, doc: &str) -> PathBuf {
    let h = crate::render::fnv1a(doc.as_bytes());
    dir.join(format!("{h:016x}.json"))
}

pub fn load(dir: &Path, doc: &str) -> Value {
    let path = file_for(dir, doc);
    let Ok(text) = fs::read_to_string(&path) else {
        return json!([]);
    };
    match serde_json::from_str::<Value>(&text) {
        // Guard against (very unlikely) hash collisions.
        Ok(v) if v.get("path").and_then(Value::as_str) == Some(doc) => {
            v.get("items").cloned().unwrap_or_else(|| json!([]))
        }
        _ => json!([]),
    }
}

pub fn save(dir: &Path, doc: &str, items: Value) -> Result<(), String> {
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let path = file_for(dir, doc);
    let empty = items.as_array().map(|a| a.is_empty()).unwrap_or(true);
    if empty {
        let _ = fs::remove_file(&path);
        return Ok(());
    }
    let body = serde_json::to_vec(&json!({ "path": doc, "items": items })).map_err(|e| e.to_string())?;
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, body).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &path).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip_and_delete() {
        let dir = std::env::temp_dir().join(format!("mdv-fb-{}", std::process::id()));
        let doc = "/a/b.md";
        assert_eq!(load(&dir, doc), json!([]));
        save(&dir, doc, json!([{ "id": "1" }])).unwrap();
        assert_eq!(load(&dir, doc), json!([{ "id": "1" }]));
        assert_eq!(load(&dir, "/other.md"), json!([]));
        save(&dir, doc, json!([])).unwrap();
        assert_eq!(load(&dir, doc), json!([]));
        let _ = fs::remove_dir_all(dir);
    }
}
