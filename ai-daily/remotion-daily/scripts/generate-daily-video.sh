#!/bin/bash
set -e

# 用法：
#   ./scripts/generate-daily-video.sh <date> [topic]
# topic 对应 data 文件与 runs 目录名：
#   data/<topic>-<date>.json  -> runs/<topic>-<date>/final.mp4

DATE=${1:-$(date +%Y-%m-%d)}
TOPIC=${2:-daily}

echo "===== 生成 ${TOPIC} ${DATE} 视频 ====="

# 进入remotion项目目录
cd "$(dirname "$0")/.."

# 数据文件路径（优先 topic）
DATA_FILE="./data/${TOPIC}-${DATE}.json"
RUN_ID="${TOPIC}-${DATE}"

# 兼容：如果 topic 文件不存在，尝试 fallback 为 daily-<date>.json
if [ ! -f "$DATA_FILE" ]; then
  if [ -f "./data/daily-${DATE}.json" ]; then
    DATA_FILE="./data/daily-${DATE}.json"
    RUN_ID="daily-${DATE}"
  else
    echo "错误: 数据文件 ./data/${TOPIC}-${DATE}.json 不存在，请先生成日报数据"
    exit 1
  fi
fi

RUN_BASE="../runs/${RUN_ID}"
mkdir -p "$RUN_BASE"

echo "使用数据: ${DATA_FILE}"
echo "输出目录: ${RUN_BASE}"

# 1) 渲染（remotion CLI 默认写到 out/DailyVideo.mp4）
echo "开始渲染视频..."
npx remotion render src/index.tsx DailyVideo --props="$DATA_FILE"

# 2) 统一归档到 runs
if [ ! -f "./out/DailyVideo.mp4" ]; then
  echo "错误: 未找到渲染产物 ./out/DailyVideo.mp4"
  exit 1
fi

cp -f "./out/DailyVideo.mp4" "${RUN_BASE}/final.mp4"
cp -f "$DATA_FILE" "${RUN_BASE}/props.json"

echo "视频生成完成：${RUN_BASE}/final.mp4"

# 可选：上传到CDN或视频平台
# ./scripts/upload.sh "$OUTPUT_FILE"

echo "===== 日报视频生成完成 ====="
