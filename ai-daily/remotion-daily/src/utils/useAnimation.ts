import { useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';

/**
 * 淡入淡出动画hook
 * @param enterDuration 入场时长（秒）
 * @param exitDuration 退场时长（秒）
 * @param delay 延迟入场（秒）
 */
export const useFadeInOut = (
  enterDuration: number = 0.5,
  exitDuration: number = 0.3,
  delay: number = 0
) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const enterStart = delay * fps;
  let enterEnd = enterStart + enterDuration * fps;
  if (enterEnd <= enterStart) {
    enterEnd = enterStart + 1;
  }

  const exitStartRaw = durationInFrames - exitDuration * fps;
  const noExitFade = exitDuration <= 0 || exitStartRaw >= durationInFrames;

  if (noExitFade) {
    const timelineEnd = Math.max(durationInFrames, enterEnd + 1e-6);
    return interpolate(
      frame,
      [enterStart, enterEnd, timelineEnd],
      [0, 1, 1],
      {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      }
    );
  }

  let exitStart = exitStartRaw;
  if (exitStart <= enterEnd) {
    exitStart = Math.min(durationInFrames - 1, enterEnd + 1);
  }
  if (exitStart >= durationInFrames) {
    exitStart = durationInFrames - 1;
  }

  return interpolate(
    frame,
    [enterStart, enterEnd, exitStart, durationInFrames],
    [0, 1, 1, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );
};

/**
 * 滑动淡入淡出动画hook
 * @param enterDuration 入场时长（秒）
 * @param exitDuration 退场时长（秒）
 * @param offsetY Y轴偏移量
 * @param delay 延迟入场（秒）
 */
export const useSlideFade = (
  enterDuration: number = 0.5,
  exitDuration: number = 0.3,
  offsetY: number = 50,
  delay: number = 0
) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const enterStart = delay * fps;
  let enterEnd = enterStart + enterDuration * fps;
  if (enterEnd <= enterStart) {
    enterEnd = enterStart + 1;
  }

  const exitStartRaw = durationInFrames - exitDuration * fps;
  const noExitFade = exitDuration <= 0 || exitStartRaw >= durationInFrames;

  const timelineEndNoExit = Math.max(durationInFrames, enterEnd + 1e-6);

  const opacityInput: [number, number, number, number] | [number, number, number] = noExitFade
    ? [enterStart, enterEnd, timelineEndNoExit]
    : (() => {
        let exitStart = exitStartRaw;
        if (exitStart <= enterEnd) {
          exitStart = Math.min(durationInFrames - 1, enterEnd + 1);
        }
        if (exitStart >= durationInFrames) {
          exitStart = durationInFrames - 1;
        }
        return [enterStart, enterEnd, exitStart, durationInFrames];
      })();

  const opacityOutput =
    opacityInput.length === 3 ? ([0, 1, 1] as const) : ([0, 1, 1, 0] as const);

  const opacity = interpolate(frame, opacityInput, opacityOutput, {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const yOutput =
    opacityInput.length === 3
      ? ([offsetY, 0, 0] as const)
      : ([offsetY, 0, 0, -offsetY * 0.6] as const);

  const y = interpolate(frame, opacityInput, yOutput, {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return { opacity, y };
};

/**
 * 弹性缩放动画hook
 * @param delay 延迟入场（秒）
 */
export const useSpringScale = (delay: number = 0) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame: frame - delay * fps,
    fps,
    from: 0.8,
    to: 1,
    config: {
      damping: 12,
      stiffness: 100,
    },
  });

  return scale;
};

/**
 * 打字机效果hook
 * @param text 要显示的文字
 * @param speed 打字速度（字符/秒）
 * @param delay 延迟开始（秒）
 */
export const useTypewriter = (text: string, speed: number = 20, delay: number = 0) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const startFrame = delay * fps;
  const charsToShow = Math.max(0, Math.floor(((frame - startFrame) / fps) * speed));

  return text.slice(0, charsToShow);
};
