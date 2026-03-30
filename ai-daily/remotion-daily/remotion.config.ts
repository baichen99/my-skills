import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setConcurrency(8); // 使用8个线程渲染
Config.setJpegQuality(100);
Config.setChromiumOpenGlRenderer('angle'); // 开启硬件加速
