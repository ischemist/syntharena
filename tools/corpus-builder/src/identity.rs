use serde_json::Value;

use crate::sha256_bytes;

pub fn canonical_json(value: &Value) -> Vec<u8> {
    let normalized = normalize(value);
    serde_json::to_vec(&normalized).expect("JSON values are serializable")
}

pub fn hash_json(value: &Value) -> String {
    sha256_bytes(&canonical_json(value))
}

fn normalize(value: &Value) -> Value {
    match value {
        Value::Array(values) => Value::Array(values.iter().map(normalize).collect()),
        Value::Object(values) => {
            let mut keys: Vec<_> = values.keys().collect();
            keys.sort();
            Value::Object(
                keys.into_iter()
                    .map(|key| (key.clone(), normalize(&values[key])))
                    .collect(),
            )
        }
        _ => value.clone(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn canonical_hash_matches_daedalus_fixture() {
        let value = json!({"z": [3, {"b": true, "a": null}], "a": "route"});
        assert_eq!(
            hash_json(&value),
            "570d8ba4bd9ffb85817956454a8040965883ef0047c3856ebb9f61a1b1fea961"
        );
    }
}
