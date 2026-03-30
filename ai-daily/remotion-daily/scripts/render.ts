#!/usr/bin/env ts-node
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'path';
import fs from 'fs/promises';

const args = process.argv.slice(2);
const dataPath = args[0] || './src/data/example.json';
const outputArg = args[1];

const deriveRunId = (propsFile: string) => {
  const base = path.basename(propsFile);
  const m = base.match(/^(.*?)-(\d{4}-\d{2}-\d{2})\.json$/i);
  if (!m) {
    const fallbackDate = new Date().toISOString().slice(0, 10);
    return { topic: 'daily', date: fallbackDate };
  }
  return { topic: m[1], date: m[2] };
};

const { topic, date } = deriveRunId(dataPath);
const runId = `${topic}-${date}`;
// remotion-daily 位于 ai-daily/remotion-daily/ 下，所以 '..' 指向 ai-daily/
const runBase = path.resolve(process.cwd(), '..', 'runs', runId);
const outputPath = outputArg || path.join(runBase, 'final.mp4');

const renderVideo = async () => {
  console.log(`加载数据文件: ${dataPath}`);
  const dataContent = await fs.readFile(dataPath, 'utf-8');
  const inputProps = JSON.parse(dataContent);

  // 输出目录与复盘资料（props.json）统一放到 runs/<runId>/ 下
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.mkdir(runBase, { recursive: true });
  const destProps = path.join(runBase, 'props.json');
  await fs.copyFile(dataPath, destProps).catch(() => {});
  console.log(`本次运行目录: ${runBase}`);

  // run 产生的音频/素材不长期放进 public：
  // 若 runs/<runId>/audio 存在，则渲染前临时拷贝到 public/audio/<runId>/，
  // 渲染结束后清理，保证 public 只存通用资源。
  const runAudioSrcDir = path.join(runBase, 'audio');
  const runAudioDestDir = path.join(process.cwd(), 'public', 'audio', runId);
  let copiedRunAudio = false;

  console.log('正在查询composition信息...');
  try {
    // 1) 将 run 音频临时拷贝进 public
    const runAudioExists = await fs
      .stat(runAudioSrcDir)
      .then((s) => s.isDirectory())
      .catch(() => false);
    if (runAudioExists) {
      await fs.rm(runAudioDestDir, { recursive: true, force: true }).catch(() => {});
      await fs.mkdir(path.dirname(runAudioDestDir), { recursive: true });
      await fs.cp(runAudioSrcDir, runAudioDestDir, { recursive: true });
      copiedRunAudio = true;
      console.log(`已临时拷贝 run 音频到: ${runAudioDestDir}`);
    }

    // 2) 渲染
    const composition = await selectComposition({
      serveUrl: path.join(process.cwd(), 'src/index.tsx'),
      id: 'DailyVideo',
      inputProps,
    });

    console.log(`开始渲染视频，时长: ${(composition.durationInFrames / composition.fps).toFixed(1)}秒`);
    console.log(`输出路径: ${outputPath}`);

    await renderMedia({
      composition,
      serveUrl: path.join(process.cwd(), 'src/index.tsx'),
      codec: 'h264',
      outputLocation: outputPath,
      inputProps,
      concurrency: 0.75,
      onProgress: ({ progress }) => {
        console.log(`渲染进度: ${(progress * 100).toFixed(1)}%`);
      },
    });
  } finally {
    // 3) 清理临时 public 音频
    if (copiedRunAudio) {
      await fs.rm(runAudioDestDir, { recursive: true, force: true }).catch(() => {});
      console.log(`已清理临时 public 音频目录: ${runAudioDestDir}`);
    }
  }

  console.log('视频渲染完成!');
};

renderVideo().catch((err) => {
  console.error('渲染失败:', err);
  process.exit(1);
});
