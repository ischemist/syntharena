#!/bin/bash

# Define datasets with their stock configurations
# Format: "dataset:stock-path:stock-db-name"
DATASET_CONFIGS=(
    # "mkt-lin-500:buyables-stock:ASKCOS Buyables Stock"
    # "mkt-cnv-160:buyables-stock:ASKCOS Buyables Stock"
    # "mkt-lin-500-single-gt:buyables-stock:ASKCOS Buyables Stock"
    # "mkt-cnv-160-single-gt:buyables-stock:ASKCOS Buyables Stock"
    "ref-lin-600:n5-stock:n5 Stock"
    "ref-cnv-400:n5-stock:n5 Stock"
    "ref-lng-84:n1-n5-stock:n1+n5 Stock"
    "uspto-190:buyables-stock:ASKCOS Buyables Stock"
)

# Define model configurations
# Format: "model-name:model-slug"
MODEL_CONFIGS=(
    "synplanner-1.3.2-nmcs:synp-nm-v1-3-2"
    "synplanner-1.3.2-mcts-val:synp-mv-v1-3-2"
    "synplanner-1.3.2-mcts-rollout:synp-m-v1-3-2"
)

ALGORITHM_ID="cmise5n3y0000fqdd9adk2lbb"

# Skip this specific combination (already done)
SKIP_DATASET="mkt-cnv-160"
SKIP_MODEL="synplanner-1.3.2-mcts-rollout"

# Calculate total jobs
total_jobs=0
for dataset_config in "${DATASET_CONFIGS[@]}"; do
    for model_config in "${MODEL_CONFIGS[@]}"; do
        IFS=':' read -r dataset stock_path stock_db <<< "$dataset_config"
        IFS=':' read -r model_name model_slug <<< "$model_config"
        if [[ "$dataset" == "$SKIP_DATASET" && "$model_name" == "$SKIP_MODEL" ]]; then
            continue
        fi
        ((total_jobs++))
    done
done

current_job=0
start_time=$(date +%s)

# Function to display progress
show_progress() {
    local current=$1
    local total=$2
    local width=30
    local percentage=$((current * 100 / total))
    local filled=$((current * width / total))
    local empty=$((width - filled))

    # Calculate ETA
    local now=$(date +%s)
    local elapsed=$((now - start_time))
    if [[ $current -gt 0 ]]; then
        local avg_time=$((elapsed / current))
        local remaining=$((total - current))
        local eta=$((avg_time * remaining))
        local eta_min=$((eta / 60))
        local eta_sec=$((eta % 60))
        local eta_str=$(printf "%dm %ds" $eta_min $eta_sec)
    else
        local eta_str="calculating..."
    fi

    # Build progress bar
    local bar=""
    for ((i=0; i<filled; i++)); do bar+="█"; done
    for ((i=0; i<empty; i++)); do bar+="░"; done

    printf "\r[%s] %d/%d (%d%%) | ETA: %s   " "$bar" "$current" "$total" "$percentage" "$eta_str"
}

echo "Starting batch load of predictions..."
echo "Total jobs: $total_jobs"
echo ""

for dataset_config in "${DATASET_CONFIGS[@]}"; do
    IFS=':' read -r dataset stock_path stock_db <<< "$dataset_config"

    for model_config in "${MODEL_CONFIGS[@]}"; do
        IFS=':' read -r model_name model_slug <<< "$model_config"

        # Skip the already completed combination
        if [[ "$dataset" == "$SKIP_DATASET" && "$model_name" == "$SKIP_MODEL" ]]; then
            echo "Skipping $dataset + $model_name (already done)"
            continue
        fi

        ((current_job++))
        show_progress $current_job $total_jobs
        echo ""
        echo "Processing: $dataset + $model_name"

        pnpm tsx scripts/load-predictions.ts "$dataset" "$model_name" \
            --model-slug "$model_slug" \
            --algorithm-id "$ALGORITHM_ID" \
            --stock-path "$stock_path" \
            --stock-db "$stock_db"

        if [[ $? -ne 0 ]]; then
            echo "Error processing $dataset + $model_name"
            exit 1
        fi

        echo "Completed: $dataset + $model_name"
        echo ""
    done
done

show_progress $total_jobs $total_jobs
echo ""
echo ""
echo "All jobs completed successfully!"
