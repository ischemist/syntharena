use std::{collections::HashSet, fs, path::Path};

use anyhow::{Context, Result, bail};
use serde::Deserialize;

use crate::{contract::ProducerEvidence, stream};

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ProducerTrustPolicy {
    pub schema_version: u8,
    pub retrocast_version: String,
    pub release_tag: String,
    pub release_commit: String,
    pub release_url: String,
    pub approved_assets: Vec<ApprovedAsset>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ApprovedAsset {
    pub name: String,
    pub asset_sha256: String,
    pub executable_sha256: String,
}

pub fn load_policy(path: &Path, expected_sha256: &str) -> Result<ProducerTrustPolicy> {
    let bytes = fs::read(path).with_context(|| format!("read {}", path.display()))?;
    if crate::sha256_bytes(&bytes) != expected_sha256 {
        bail!("producer trust policy SHA-256 disagrees with catalog");
    }
    let policy: ProducerTrustPolicy = serde_json::from_slice(&bytes)?;
    if policy.schema_version != 1
        || policy.retrocast_version.trim().is_empty()
        || policy.release_tag.trim().is_empty()
        || policy.release_commit.len() != 40
        || !policy
            .release_commit
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit())
        || !policy.release_url.starts_with("https://")
        || policy.approved_assets.is_empty()
    {
        bail!("producer trust policy metadata is invalid");
    }
    let mut names = HashSet::new();
    for asset in &policy.approved_assets {
        if asset.name.trim().is_empty()
            || !valid_sha256(&asset.asset_sha256)
            || !valid_sha256(&asset.executable_sha256)
            || !names.insert(asset.name.as_str())
        {
            bail!("producer trust policy asset is invalid or duplicated");
        }
    }
    Ok(policy)
}

pub fn validate_producer(policy: &ProducerTrustPolicy, evidence: &ProducerEvidence) -> Result<()> {
    if evidence.retrocast_version != policy.retrocast_version
        || evidence.release_tag != policy.release_tag
        || evidence.release_commit != policy.release_commit
        || evidence.release_url != policy.release_url
    {
        bail!("producer evidence disagrees with the reviewed trust policy release");
    }
    let approved = policy.approved_assets.iter().any(|asset| {
        evidence.release_asset == asset.name
            && evidence.release_asset_sha256 == asset.asset_sha256
            && evidence.executable_sha256 == asset.executable_sha256
    });
    if !approved {
        bail!("producer executable/release asset pair is not approved by the trust policy");
    }
    Ok(())
}

pub fn load_workspace_policy(
    root: &Path,
    config: &crate::config::ProducerTrustConfig,
) -> Result<ProducerTrustPolicy> {
    let path = stream::resolve_confined_regular(root, &config.policy_path)?;
    load_policy(&path, &config.policy_sha256)
}

fn valid_sha256(value: &str) -> bool {
    value.len() == 64
        && value.bytes().all(|byte| byte.is_ascii_hexdigit())
        && value == value.to_ascii_lowercase()
}
