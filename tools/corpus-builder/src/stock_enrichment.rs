use std::{fs, path::Path};

use anyhow::{Context, Result, bail};
use serde::Deserialize;

use crate::stream;

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct StockEnrichmentManifest {
    schema_version: u8,
    action: String,
    stock_name: String,
    source: EnrichmentSource,
    artifact: EnrichmentArtifact,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct EnrichmentSource {
    database_sha256: String,
    description: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct EnrichmentArtifact {
    path: String,
    sha256: String,
    rows: usize,
}

impl StockEnrichmentManifest {
    pub fn rows(&self) -> usize {
        self.artifact.rows
    }

    pub fn source_database_sha256(&self) -> &str {
        &self.source.database_sha256
    }
}

pub fn validate_manifest(
    manifest_path: &Path,
    expected_manifest_sha256: &str,
    artifact_path: &Path,
    expected_artifact_sha256: &str,
    stock_name: &str,
) -> Result<StockEnrichmentManifest> {
    let bytes =
        fs::read(manifest_path).with_context(|| format!("read {}", manifest_path.display()))?;
    let actual_manifest_sha256 = crate::sha256_bytes(&bytes);
    if actual_manifest_sha256 != expected_manifest_sha256 {
        bail!("stock enrichment manifest SHA-256 disagrees with catalog");
    }
    let manifest: StockEnrichmentManifest = serde_json::from_slice(&bytes)
        .with_context(|| format!("parse {}", manifest_path.display()))?;
    if manifest.schema_version != 1
        || manifest.action != "export-stock-enrichment"
        || manifest.stock_name != stock_name
        || manifest.source.description.trim().is_empty()
        || !valid_sha256(&manifest.source.database_sha256)
        || manifest.artifact.rows == 0
        || !valid_sha256(&manifest.artifact.sha256)
    {
        bail!("stock enrichment manifest metadata is invalid");
    }
    let declared_name = Path::new(&manifest.artifact.path)
        .file_name()
        .and_then(|value| value.to_str());
    if declared_name != artifact_path.file_name().and_then(|value| value.to_str()) {
        bail!("stock enrichment manifest artifact path disagrees with its file");
    }
    if manifest.artifact.sha256 != expected_artifact_sha256 {
        bail!("stock enrichment artifact SHA-256 disagrees with catalog");
    }
    let actual_artifact_sha256 = stream::sha256_file(artifact_path)?;
    if actual_artifact_sha256 != expected_artifact_sha256 {
        bail!("stock enrichment artifact SHA-256 mismatch");
    }
    Ok(manifest)
}

fn valid_sha256(value: &str) -> bool {
    value.len() == 64
        && value.bytes().all(|byte| byte.is_ascii_hexdigit())
        && value == value.to_ascii_lowercase()
}
