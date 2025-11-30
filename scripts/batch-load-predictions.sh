#!/opt/homebrew/bin/bash

# Batch run script for loading predictions across all models and datasets
# This script loads routes, evaluations, and statistics for all model-dataset combinations

# Note: We don't use 'set -e' because we want to continue even if individual jobs fail

# Define models
MODELS=(
    "dms-explorer-xl"
    "aizynthfinder-retro-star"
    "aizynthfinder-mcts"
    "retro-star"
    "retro-star-high"
    "askcos"
    "syntheseus-retro0-local-retro"
)

# Define model metadata (algorithm names, papers, versions)
declare -A ALGORITHM_NAMES=(
    ["dms-explorer-xl"]="DirectMultiStep"
    ["aizynthfinder-retro-star"]="AiZynthFinder Retro*"
    ["aizynthfinder-mcts"]="AiZynthFinder MCTS"
    ["retro-star"]="Retro*"
    ["retro-star-high"]="Retro* (High Effort)"
    ["askcos"]="ASKCOS"
    ["syntheseus-retro0-local-retro"]="Syntheseus Retro0 Local Retro"
)

declare -A ALGORITHM_PAPERS=(
    ["dms-explorer-xl"]="https://arxiv.org/abs/2405.13983"
)

declare -A MODEL_VERSIONS=(
    ["dms-explorer-xl"]="v1.0"
)

# Define datasets with their stock configurations
# Format: "dataset:stock-path:stock-db-name"
DATASET_CONFIGS=(
    # "mkt-lin-500:buyables-stock:ASKCOS Buyables Stock"
    # "mkt-cnv-160:buyables-stock:ASKCOS Buyables Stock"
    # "ref-lin-600:n5-stock:n5 Stock"
    # "ref-cnv-400:n5-stock:n5 Stock"
    # "ref-lng-84:n1-n5-stock:n1+n5 Stock"
    "uspto-190:buyables-stock:ASKCOS Buyables Stock"
)

# Progress bar function with ETA and elapsed time
show_progress() {
    local current=$1
    local total=$2
    local description=$3
    local width=40
    local percentage=$((current * 100 / total))
    local completed=$((width * current / total))
    local remaining=$((width - completed))

    # Calculate elapsed time
    local elapsed=$(($(date +%s) - START_TIME))
    local elapsed_hours=$((elapsed / 3600))
    local elapsed_minutes=$(((elapsed % 3600) / 60))
    local elapsed_secs=$((elapsed % 60))

    local elapsed_msg=""
    if [ "$elapsed_hours" -gt 0 ]; then
        elapsed_msg=$(printf "%dh %dm %ds" "$elapsed_hours" "$elapsed_minutes" "$elapsed_secs")
    elif [ "$elapsed_minutes" -gt 0 ]; then
        elapsed_msg=$(printf "%dm %ds" "$elapsed_minutes" "$elapsed_secs")
    else
        elapsed_msg=$(printf "%ds" "$elapsed_secs")
    fi

    # Calculate ETA
    local eta_msg=""
    if [ "$current" -gt 0 ]; then
        local avg_time_per_step=$((elapsed / current))
        local remaining_steps=$((total - current))
        local eta_seconds=$((avg_time_per_step * remaining_steps))

        local eta_hours=$((eta_seconds / 3600))
        local eta_minutes=$(((eta_seconds % 3600) / 60))
        local eta_secs=$((eta_seconds % 60))

        if [ "$eta_hours" -gt 0 ]; then
            eta_msg=$(printf "%dh %dm %ds" "$eta_hours" "$eta_minutes" "$eta_secs")
        elif [ "$eta_minutes" -gt 0 ]; then
            eta_msg=$(printf "%dm %ds" "$eta_minutes" "$eta_secs")
        else
            eta_msg=$(printf "%ds" "$eta_secs")
        fi
    else
        eta_msg="calculating..."
    fi

    printf "\r["
    printf "%${completed}s" | tr ' ' '='
    printf "%${remaining}s" | tr ' ' '-'
    printf "] %3d%% (%d/%d) Elapsed: %s | ETA: %s | %s" "$percentage" "$current" "$total" "$elapsed_msg" "$eta_msg" "$description"
}

# Calculate total steps
TOTAL_STEPS=$((${#MODELS[@]} * ${#DATASET_CONFIGS[@]}))
CURRENT_STEP=0

# Track start time for ETA calculation
START_TIME=$(date +%s)

echo "=========================================="
echo "Batch Prediction Loading Script"
echo "=========================================="
echo "Total models:   ${#MODELS[@]}"
echo "Total datasets: ${#DATASET_CONFIGS[@]}"
echo "Total jobs:     ${TOTAL_STEPS}"
echo "=========================================="
echo ""

# Track failures
FAILED_JOBS=()

# Main loop: iterate through all models and datasets
for model in "${MODELS[@]}"; do
    for config in "${DATASET_CONFIGS[@]}"; do
        # Parse dataset config
        IFS=':' read -r dataset stock_path stock_db <<< "$config"

        # Build command array
        algorithm="${ALGORITHM_NAMES[$model]}"
        cmd_args=(
            pnpm tsx scripts/load-predictions.ts
            "$dataset"
            "$model"
            --algorithm "$algorithm"
            --stock-path "$stock_path"
            --stock-db "$stock_db"
        )

        # Add optional parameters if they exist
        if [[ -n "${ALGORITHM_PAPERS[$model]}" ]]; then
            cmd_args+=(--algorithm-paper "${ALGORITHM_PAPERS[$model]}")
        fi
        if [[ -n "${MODEL_VERSIONS[$model]}" ]]; then
            cmd_args+=(--model-version "${MODEL_VERSIONS[$model]}")
        fi

        # Increment step counter
        ((CURRENT_STEP++))

        # Show progress
        show_progress "$CURRENT_STEP" "$TOTAL_STEPS" "${model}/${dataset}: Loading..."

        # Execute command silently, capturing output
        if ! "${cmd_args[@]}" > /dev/null 2>&1; then
            # Record failure
            FAILED_JOBS+=("${model}/${dataset}")
        fi
    done
done

echo ""
echo ""

# Calculate total elapsed time
TOTAL_ELAPSED=$(($(date +%s) - START_TIME))
TOTAL_HOURS=$((TOTAL_ELAPSED / 3600))
TOTAL_MINUTES=$(((TOTAL_ELAPSED % 3600) / 60))
TOTAL_SECS=$((TOTAL_ELAPSED % 60))

echo "=========================================="
echo "Batch Loading Complete!"
echo "=========================================="
echo "Total jobs:      ${TOTAL_STEPS}"
echo "Successful:      $((TOTAL_STEPS - ${#FAILED_JOBS[@]}))"
echo "Failed:          ${#FAILED_JOBS[@]}"

if [ "$TOTAL_HOURS" -gt 0 ]; then
    printf "Total time:      %dh %dm %ds\n" "$TOTAL_HOURS" "$TOTAL_MINUTES" "$TOTAL_SECS"
elif [ "$TOTAL_MINUTES" -gt 0 ]; then
    printf "Total time:      %dm %ds\n" "$TOTAL_MINUTES" "$TOTAL_SECS"
else
    printf "Total time:      %ds\n" "$TOTAL_SECS"
fi

if [ ${#FAILED_JOBS[@]} -gt 0 ]; then
    echo ""
    echo "Failed jobs:"
    for job in "${FAILED_JOBS[@]}"; do
        echo "  - $job"
    done
fi

echo "=========================================="
