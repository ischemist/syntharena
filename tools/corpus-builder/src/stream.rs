use std::{
    collections::{BTreeMap, HashMap},
    fmt,
    fs::{self, File},
    io::{BufReader, Read},
    path::Path,
    sync::{Arc, Mutex},
};

use anyhow::{Context, Result, bail};
use flate2::read::GzDecoder;
use serde::{
    Deserialize, Deserializer,
    de::{DeserializeSeed, IgnoredAny, MapAccess, Visitor},
};
use serde_json::{Map, Value};
use sha2::{Digest, Sha256};

use crate::{
    identity::hash_json,
    wire::{Candidate, EvaluationHeader, TargetResult},
};

pub type CandidateDigests = HashMap<String, (usize, String)>;

#[derive(Default)]
struct HashState {
    hasher: Sha256,
    bytes: u64,
}

struct HashingReader<R> {
    inner: R,
    state: Arc<Mutex<HashState>>,
}

impl<R: Read> Read for HashingReader<R> {
    fn read(&mut self, buffer: &mut [u8]) -> std::io::Result<usize> {
        let count = self.inner.read(buffer)?;
        if count > 0 {
            let mut state = self.state.lock().expect("hash state lock poisoned");
            state.hasher.update(&buffer[..count]);
            state.bytes += count as u64;
        }
        Ok(count)
    }
}

pub fn parse_hashed_json_gz<T>(path: &Path, expected_sha256: &str) -> Result<T>
where
    T: for<'de> Deserialize<'de>,
{
    let file = File::open(path).with_context(|| format!("open {}", path.display()))?;
    let expected_bytes = file.metadata()?.len();
    let state = Arc::new(Mutex::new(HashState::default()));
    let reader = HashingReader {
        inner: file,
        state: Arc::clone(&state),
    };
    let mut deserializer =
        serde_json::Deserializer::from_reader(BufReader::new(GzDecoder::new(reader)));
    let value =
        T::deserialize(&mut deserializer).with_context(|| format!("parse {}", path.display()))?;
    deserializer.end()?;
    drop(deserializer);
    assert_hash_state(path, expected_sha256, expected_bytes, &state)?;
    Ok(value)
}

pub fn stream_stock_csv<F>(path: &Path, expected_sha256: &str, mut row: F) -> Result<usize>
where
    F: FnMut(&str, &str) -> Result<()>,
{
    let file = File::open(path).with_context(|| format!("open {}", path.display()))?;
    let expected_bytes = file.metadata()?.len();
    let state = Arc::new(Mutex::new(HashState::default()));
    let reader = HashingReader {
        inner: file,
        state: Arc::clone(&state),
    };
    let mut csv = csv::Reader::from_reader(BufReader::new(GzDecoder::new(reader)));
    let headers = csv.headers()?.clone();
    if headers.len() < 2
        || !headers[0].to_ascii_lowercase().contains("smiles")
        || !headers[1].to_ascii_lowercase().contains("inchi")
    {
        bail!("stock CSV must begin with SMILES and InChIKey columns");
    }
    let mut count = 0;
    for record in csv.records() {
        let record = record?;
        let smiles = record.get(0).unwrap_or("").trim();
        let inchikey = record.get(1).unwrap_or("").trim();
        if smiles.is_empty() || inchikey.is_empty() {
            bail!("stock CSV contains an empty SMILES or InChIKey");
        }
        row(smiles, inchikey)?;
        count += 1;
    }
    drop(csv);
    assert_hash_state(path, expected_sha256, expected_bytes, &state)?;
    Ok(count)
}

pub fn stream_candidate_digests(
    path: &Path,
    expected_sha256: &str,
) -> Result<(CandidateDigests, usize)> {
    let file = File::open(path).with_context(|| format!("open {}", path.display()))?;
    let expected_bytes = file.metadata()?.len();
    let state = Arc::new(Mutex::new(HashState::default()));
    let reader = HashingReader {
        inner: file,
        state: Arc::clone(&state),
    };
    let mut deserializer =
        serde_json::Deserializer::from_reader(BufReader::new(GzDecoder::new(reader)));
    let output = CandidateMapSeed
        .deserialize(&mut deserializer)
        .with_context(|| format!("stream {}", path.display()))?;
    deserializer.end()?;
    drop(deserializer);
    assert_hash_state(path, expected_sha256, expected_bytes, &state)?;
    Ok(output)
}

pub trait EvaluationSink {
    fn begin(&mut self, header: &EvaluationHeader) -> Result<()>;
    fn target(&mut self, target_id: &str, target: TargetResult) -> Result<()>;
    fn finish(&mut self, schema_version: &str) -> Result<()>;
}

pub fn stream_evaluation<S: EvaluationSink>(
    path: &Path,
    expected_sha256: &str,
    sink: &mut S,
) -> Result<()> {
    let file = File::open(path).with_context(|| format!("open {}", path.display()))?;
    let expected_bytes = file.metadata()?.len();
    let state = Arc::new(Mutex::new(HashState::default()));
    let reader = HashingReader {
        inner: file,
        state: Arc::clone(&state),
    };
    let mut deserializer =
        serde_json::Deserializer::from_reader(BufReader::new(GzDecoder::new(reader)));
    EvaluationSeed { sink }
        .deserialize(&mut deserializer)
        .with_context(|| format!("stream {}", path.display()))?;
    deserializer.end()?;
    drop(deserializer);
    assert_hash_state(path, expected_sha256, expected_bytes, &state)?;
    Ok(())
}

fn assert_hash_state(
    path: &Path,
    expected_sha256: &str,
    expected_bytes: u64,
    state: &Arc<Mutex<HashState>>,
) -> Result<()> {
    let state = state.lock().expect("hash state lock poisoned");
    if state.bytes != expected_bytes {
        bail!(
            "parser did not consume the complete compressed file {}: {} of {} bytes",
            path.display(),
            state.bytes,
            expected_bytes
        );
    }
    let actual = format!("{:x}", state.hasher.clone().finalize());
    if actual != expected_sha256.to_ascii_lowercase() {
        bail!(
            "SHA-256 mismatch for {}: expected {}, got {}",
            path.display(),
            expected_sha256,
            actual
        );
    }
    Ok(())
}

struct CandidateMapSeed;

impl<'de> DeserializeSeed<'de> for CandidateMapSeed {
    type Value = (CandidateDigests, usize);

    fn deserialize<D>(self, deserializer: D) -> std::result::Result<Self::Value, D::Error>
    where
        D: Deserializer<'de>,
    {
        deserializer.deserialize_map(CandidateMapVisitor)
    }
}

struct CandidateMapVisitor;

impl<'de> Visitor<'de> for CandidateMapVisitor {
    type Value = (CandidateDigests, usize);

    fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
        formatter.write_str("a target-keyed candidate object")
    }

    fn visit_map<A>(self, mut map: A) -> std::result::Result<Self::Value, A::Error>
    where
        A: MapAccess<'de>,
    {
        let mut digests = HashMap::new();
        let mut total = 0;
        while let Some(target_id) = map.next_key::<String>()? {
            if digests.contains_key(&target_id) {
                return Err(serde::de::Error::custom(format!(
                    "duplicate candidate target {target_id}"
                )));
            }
            let candidates = map.next_value::<Vec<Candidate>>()?;
            for (index, candidate) in candidates.iter().enumerate() {
                candidate.validate().map_err(serde::de::Error::custom)?;
                if candidate.rank != index + 1 {
                    return Err(serde::de::Error::custom(
                        "candidate ranks must be ordered and contiguous from 1",
                    ));
                }
            }
            let count = candidates.len();
            let digest = hash_json(
                &serde_json::to_value(candidates).expect("candidate projection is serializable"),
            );
            total += count;
            digests.insert(target_id, (count, digest));
        }
        Ok((digests, total))
    }
}

#[derive(Deserialize)]
struct TaskHeaderWire {
    name: String,
    #[serde(default)]
    description: String,
    targets: BTreeMap<String, TaskTargetBinding>,
    #[serde(default)]
    default_constraints: Vec<Value>,
    #[serde(default)]
    constraints: BTreeMap<String, Vec<Value>>,
    #[serde(default)]
    metric_label: Option<String>,
    #[serde(default)]
    annotations: Map<String, Value>,
    #[serde(default = "schema_v2")]
    schema_version: String,
}

#[derive(Clone, Debug)]
struct TaskTargetBinding {
    id: String,
    smiles: String,
    inchikey: String,
    acceptable_route_hashes: Vec<String>,
}

impl<'de> Deserialize<'de> for TaskTargetBinding {
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        #[derive(Deserialize)]
        struct Wire {
            id: String,
            smiles: String,
            inchikey: String,
            #[serde(default)]
            acceptable_routes: Vec<crate::wire::Route>,
        }
        let wire = Wire::deserialize(deserializer)?;
        Ok(Self {
            id: wire.id,
            smiles: wire.smiles,
            inchikey: wire.inchikey,
            acceptable_route_hashes: wire
                .acceptable_routes
                .iter()
                .map(crate::wire::route_content_hash)
                .collect(),
        })
    }
}

fn schema_v2() -> String {
    "2".to_owned()
}

impl TaskHeaderWire {
    fn task_json(&self) -> String {
        serde_json::to_string(&serde_json::json!({
            "name": self.name,
            "description": self.description,
            "default_constraints": self.default_constraints,
            "constraints": self.constraints,
            "metric_label": self.metric_label,
            "annotations": self.annotations,
            "schema_version": self.schema_version,
        }))
        .expect("task header is serializable")
    }
}

struct EvaluationSeed<'a, S> {
    sink: &'a mut S,
}

impl<'de, S: EvaluationSink> DeserializeSeed<'de> for EvaluationSeed<'_, S> {
    type Value = ();

    fn deserialize<D>(self, deserializer: D) -> std::result::Result<(), D::Error>
    where
        D: Deserializer<'de>,
    {
        deserializer.deserialize_map(EvaluationVisitor { sink: self.sink })
    }
}

struct EvaluationVisitor<'a, S> {
    sink: &'a mut S,
}

impl<'de, S: EvaluationSink> Visitor<'de> for EvaluationVisitor<'_, S> {
    type Value = ();

    fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
        formatter.write_str("a RetroCast v0.8.3 schema-v2 evaluation object")
    }

    fn visit_map<A>(self, mut map: A) -> std::result::Result<(), A::Error>
    where
        A: MapAccess<'de>,
    {
        let mut task: Option<TaskHeaderWire> = None;
        let mut tiers: Option<Vec<u8>> = None;
        let mut metric_label: Option<String> = None;
        let mut match_level: Option<String> = None;
        let mut route_match: Option<String> = None;
        let mut schema_version: Option<String> = None;
        let mut saw_targets = false;
        while let Some(key) = map.next_key::<String>()? {
            match key.as_str() {
                "task" => {
                    if task.replace(map.next_value()?).is_some() {
                        return Err(serde::de::Error::duplicate_field("task"));
                    }
                }
                "tiers" => {
                    if tiers.replace(map.next_value()?).is_some() {
                        return Err(serde::de::Error::duplicate_field("tiers"));
                    }
                }
                "metric_label" => {
                    if metric_label.replace(map.next_value()?).is_some() {
                        return Err(serde::de::Error::duplicate_field("metric_label"));
                    }
                }
                "acceptable_match_level" => {
                    if match_level.replace(map.next_value()?).is_some() {
                        return Err(serde::de::Error::duplicate_field("acceptable_match_level"));
                    }
                }
                "acceptable_route_match" => {
                    if route_match.replace(map.next_value()?).is_some() {
                        return Err(serde::de::Error::duplicate_field("acceptable_route_match"));
                    }
                }
                "targets" => {
                    if saw_targets {
                        return Err(serde::de::Error::duplicate_field("targets"));
                    }
                    let task = task.as_ref().ok_or_else(|| {
                        serde::de::Error::custom("evaluation task must precede targets")
                    })?;
                    if task.schema_version != "2" {
                        return Err(serde::de::Error::custom(
                            "evaluation task schema_version must be exactly 2",
                        ));
                    }
                    let header = EvaluationHeader {
                        task_name: task.name.clone(),
                        task_json: task.task_json(),
                        tiers: tiers.clone().ok_or_else(|| {
                            serde::de::Error::custom("evaluation tiers must precede targets")
                        })?,
                        metric_label: metric_label.clone().ok_or_else(|| {
                            serde::de::Error::custom("evaluation metric_label must precede targets")
                        })?,
                        acceptable_match_level: match_level.clone().ok_or_else(|| {
                            serde::de::Error::custom(
                                "evaluation acceptable_match_level must precede targets",
                            )
                        })?,
                        acceptable_route_match: route_match.clone().ok_or_else(|| {
                            serde::de::Error::custom(
                                "evaluation acceptable_route_match must precede targets",
                            )
                        })?,
                        task_default_constraints: task.default_constraints.clone(),
                        task_constraints: task.constraints.clone(),
                        task_metric_label: task.metric_label.clone(),
                    };
                    self.sink.begin(&header).map_err(serde::de::Error::custom)?;
                    map.next_value_seed(TargetMapSeed {
                        sink: self.sink,
                        bindings: &task.targets,
                    })?;
                    saw_targets = true;
                }
                "schema_version" => {
                    if schema_version.replace(map.next_value()?).is_some() {
                        return Err(serde::de::Error::duplicate_field("schema_version"));
                    }
                }
                _ => {
                    map.next_value::<IgnoredAny>()?;
                }
            }
        }
        if !saw_targets {
            return Err(serde::de::Error::missing_field("targets"));
        }
        self.sink
            .finish(
                schema_version
                    .as_deref()
                    .ok_or_else(|| serde::de::Error::missing_field("schema_version"))?,
            )
            .map_err(serde::de::Error::custom)
    }
}

struct TargetMapSeed<'a, S> {
    sink: &'a mut S,
    bindings: &'a BTreeMap<String, TaskTargetBinding>,
}

impl<'de, S: EvaluationSink> DeserializeSeed<'de> for TargetMapSeed<'_, S> {
    type Value = ();

    fn deserialize<D>(self, deserializer: D) -> std::result::Result<(), D::Error>
    where
        D: Deserializer<'de>,
    {
        deserializer.deserialize_map(TargetMapVisitor {
            sink: self.sink,
            bindings: self.bindings,
        })
    }
}

struct TargetMapVisitor<'a, S> {
    sink: &'a mut S,
    bindings: &'a BTreeMap<String, TaskTargetBinding>,
}

impl<'de, S: EvaluationSink> Visitor<'de> for TargetMapVisitor<'_, S> {
    type Value = ();

    fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
        formatter.write_str("a target-keyed evaluation object")
    }

    fn visit_map<A>(self, mut map: A) -> std::result::Result<(), A::Error>
    where
        A: MapAccess<'de>,
    {
        let mut seen = std::collections::HashSet::new();
        while let Some(target_id) = map.next_key::<String>()? {
            if !seen.insert(target_id.clone()) {
                return Err(serde::de::Error::custom(format!(
                    "duplicate evaluation target {target_id}"
                )));
            }
            let target = map.next_value::<TargetResult>()?;
            let binding = self.bindings.get(&target_id).ok_or_else(|| {
                serde::de::Error::custom(format!(
                    "evaluation target {target_id} is absent from task targets"
                ))
            })?;
            let acceptable_hashes: Vec<_> = target
                .target
                .acceptable_routes
                .iter()
                .map(crate::wire::route_content_hash)
                .collect();
            if binding.id != target.target.id
                || binding.smiles != target.target.smiles
                || binding.inchikey != target.target.inchikey
                || binding.acceptable_route_hashes != acceptable_hashes
            {
                return Err(serde::de::Error::custom(format!(
                    "evaluation target {target_id} disagrees with its task binding"
                )));
            }
            self.sink
                .target(&target_id, target)
                .map_err(serde::de::Error::custom)?;
        }
        if seen.len() != self.bindings.len() {
            return Err(serde::de::Error::custom(format!(
                "evaluation target set has {} entries but task has {}",
                seen.len(),
                self.bindings.len()
            )));
        }
        Ok(())
    }
}

pub fn sha256_file(path: &Path) -> Result<String> {
    let mut file = File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 64 * 1024];
    loop {
        let count = file.read(&mut buffer)?;
        if count == 0 {
            break;
        }
        hasher.update(&buffer[..count]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

pub fn resolve_confined_regular(root: &Path, relative: &str) -> Result<std::path::PathBuf> {
    let relative_path = Path::new(relative);
    if relative_path.is_absolute() {
        bail!("bundle output path must be relative: {relative}");
    }
    let canonical_root = fs::canonicalize(root)?;
    let canonical = fs::canonicalize(root.join(relative_path))?;
    if !canonical.starts_with(&canonical_root) || canonical == canonical_root {
        bail!("bundle output escapes its root: {relative}");
    }
    if !canonical.metadata()?.is_file() {
        bail!("bundle output is not a regular file: {relative}");
    }
    Ok(canonical)
}

#[cfg(test)]
mod tests {
    use std::io::Write;

    use flate2::{Compression, write::GzEncoder};
    use serde_json::json;

    use super::*;

    fn gzip_file(directory: &Path, name: &str, payload: &[u8]) -> (std::path::PathBuf, String) {
        let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
        encoder.write_all(payload).unwrap();
        let bytes = encoder.finish().unwrap();
        let path = directory.join(name);
        fs::write(&path, &bytes).unwrap();
        (path, crate::sha256_bytes(&bytes))
    }

    #[test]
    fn hashed_parser_rejects_digest_mismatch_and_trailing_json() {
        let directory = tempfile::tempdir().unwrap();
        let (valid, _) = gzip_file(directory.path(), "valid.json.gz", br#"{"value":1}"#);
        assert!(parse_hashed_json_gz::<Value>(&valid, &"0".repeat(64)).is_err());

        let (trailing, hash) = gzip_file(
            directory.path(),
            "trailing.json.gz",
            br#"{"value":1} trailing"#,
        );
        assert!(parse_hashed_json_gz::<Value>(&trailing, &hash).is_err());
    }

    #[test]
    fn candidate_stream_rejects_xor_and_noncontiguous_ranks() {
        let directory = tempfile::tempdir().unwrap();
        let (xor, xor_hash) = gzip_file(
            directory.path(),
            "xor.json.gz",
            br#"{"target":[{"rank":1,"route":null,"failure":null}]}"#,
        );
        assert!(stream_candidate_digests(&xor, &xor_hash).is_err());

        let (ranks, ranks_hash) = gzip_file(
            directory.path(),
            "ranks.json.gz",
            br#"{"target":[{"rank":2,"failure":{"code":"bad","context":{}}}]}"#,
        );
        assert!(stream_candidate_digests(&ranks, &ranks_hash).is_err());
    }

    #[derive(Default)]
    struct NoopSink;

    impl EvaluationSink for NoopSink {
        fn begin(&mut self, _header: &EvaluationHeader) -> Result<()> {
            Ok(())
        }

        fn target(&mut self, _target_id: &str, _target: TargetResult) -> Result<()> {
            Ok(())
        }

        fn finish(&mut self, schema_version: &str) -> Result<()> {
            if schema_version != "2" {
                bail!("wrong schema");
            }
            Ok(())
        }
    }

    fn evaluation_json(tail: &str) -> String {
        format!(
            r#"{{"task":{{"name":"bench","targets":{{}},"schema_version":"2"}},"tiers":[0],"metric_label":"stock","acceptable_match_level":"full","acceptable_route_match":"prefix","targets":{{}}{tail}}}"#
        )
    }

    #[test]
    fn evaluation_requires_explicit_schema_and_rejects_duplicate_singletons() {
        let directory = tempfile::tempdir().unwrap();
        let (missing, missing_hash) = gzip_file(
            directory.path(),
            "missing.json.gz",
            evaluation_json("").as_bytes(),
        );
        assert!(stream_evaluation(&missing, &missing_hash, &mut NoopSink).is_err());

        let duplicate = r#"{"task":{"name":"bench","targets":{},"schema_version":"2"},"tiers":[0],"tiers":[0],"metric_label":"stock","acceptable_match_level":"full","acceptable_route_match":"prefix","targets":{},"schema_version":"2"}"#;
        let (duplicate, duplicate_hash) =
            gzip_file(directory.path(), "duplicate.json.gz", duplicate.as_bytes());
        assert!(stream_evaluation(&duplicate, &duplicate_hash, &mut NoopSink).is_err());
    }

    #[test]
    fn confined_output_rejects_parent_escape_and_symlink() {
        let directory = tempfile::tempdir().unwrap();
        let root = directory.path().join("bundle");
        fs::create_dir(&root).unwrap();
        fs::write(directory.path().join("outside.json"), b"{}").unwrap();
        assert!(resolve_confined_regular(&root, "../outside.json").is_err());

        #[cfg(unix)]
        {
            std::os::unix::fs::symlink(
                directory.path().join("outside.json"),
                root.join("link.json"),
            )
            .unwrap();
            assert!(resolve_confined_regular(&root, "link.json").is_err());

            let corpus = directory.path().join("corpus");
            let outside_bundle = directory.path().join("outside-bundle");
            fs::create_dir_all(corpus.join("bundles/bench")).unwrap();
            fs::create_dir(&outside_bundle).unwrap();
            fs::write(outside_bundle.join("manifest.json"), b"{}").unwrap();
            std::os::unix::fs::symlink(&outside_bundle, corpus.join("bundles/bench/model"))
                .unwrap();
            assert!(
                resolve_confined_regular(&corpus, "bundles/bench/model/manifest.json").is_err()
            );
        }
    }

    #[test]
    fn candidate_digest_matches_canonical_projection() {
        let directory = tempfile::tempdir().unwrap();
        let payload = json!({"target": [{"rank": 1, "failure": {"code": "bad", "context": {}}}]});
        let (path, hash) = gzip_file(
            directory.path(),
            "candidate.json.gz",
            serde_json::to_string(&payload).unwrap().as_bytes(),
        );
        let (digests, count) = stream_candidate_digests(&path, &hash).unwrap();
        assert_eq!(count, 1);
        assert_eq!(digests["target"].0, 1);
    }
}
