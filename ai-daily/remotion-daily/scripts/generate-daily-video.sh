#!/bin/bash
set -e

# 日期参数，默认今天
DATE=${1:-$(date +%Y-%m-%d)}

# 数据文件路径
DATA_FILE="./data/daily-${DATE}.json"

echo "===== 生成 ${DATE} 日报视频 ====="

# 检查数据文件是否存在
if [ ! -f "$DATA_FILE" ]; then
  echo "错误: 数据文件 $DATA_FILE 不存在，请先生成日报数据"
  exit 1
fi

# 确保输出目录存在
mkdir -p output

# 进入remotion项目目录
cd "$(dirname "$0")/.."

# 渲染视频（使用 runs 目录落盘、并在 render 前临时拷贝音频到 public）
echo "开始渲染视频..."
npx ts-node scripts/render.ts "$DATA_FILE"

echo "视频生成完成（已写入 runs 目录）"
# 可选：输出统计由 render.ts 自行处理

# 可选：上传到CDN或视频平台
# ./scripts/upload.sh "$OUTPUT_FILE"

echo "===== 日报视频生成完成 ====="
