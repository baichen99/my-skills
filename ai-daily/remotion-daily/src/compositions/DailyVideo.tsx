import { Series, useVideoConfig, Audio } from 'remotion';
import { TitlePage } from '../components/TitlePage';
import { NewsCard } from '../components/NewsCard';
import { EndingPage } from '../components/EndingPage';
import { parseDailyData, type DailyDataInput } from '../data/schema';

export const DailyVideo: React.FC<DailyDataInput> = (raw) => {
  const data = parseDailyData(raw);
  const { fps, durationInFrames } = useVideoConfig();

  // 计算各部分时长（由音频时长对齐，避免“画面先翻、音频没读完”）
  const titleDuration = (data.openingDuration ?? 5) * fps;
  const endingDuration = (data.endingDuration ?? 3) * fps;

  // 提示音效：尽量“少量且固定节拍”，避免抢口播。
  const sfxLenFrames = Math.floor(0.35 * fps);
  // 切换音效尽量贴近“卡片开始”的瞬间，避免被语音的开头淹没
  const titleSfxInFrame = 0;
  const titleSfxOutFrame = Math.max(0, Math.floor(titleDuration - 0.35 * fps));
  const newsSfxInFrame = 0;
  const newsSfxOutFrameOffset = Math.floor(0.2 * fps);
  const newsSfxLenFrames = Math.floor(0.3 * fps);
  const endingSfxInFrame = 0;
  const endingSfxOutFrame = Math.max(0, Math.floor(endingDuration - 0.35 * fps));

  // 语音是主音轨；这里的音效用于“切换感”，需要比之前更容易听清
  const SFX_VOL_IN = 0.35;
  const SFX_VOL_OUT = 0.28;

  return (
    <>
      {/* 背景音乐 */}
      {data.backgroundAudio && (
        <Audio
          src={data.backgroundAudio}
          volume={1}
          startFrom={0}
          endAt={titleDuration}
        />
      )}

      <Series>
        {/* 标题页 */}
        <Series.Sequence durationInFrames={titleDuration}>
          <TitlePage data={data} durationInFrames={titleDuration} />
          {data.backgroundAudio && (
            <>
              <Audio
                src="https://remotion.media/ding.wav"
                volume={SFX_VOL_IN}
                startFrom={titleSfxInFrame}
                endAt={titleSfxInFrame + sfxLenFrames}
              />
              <Audio
                src="https://remotion.media/whoosh.wav"
                volume={SFX_VOL_OUT}
                startFrom={titleSfxOutFrame}
                endAt={titleSfxOutFrame + sfxLenFrames}
              />
            </>
          )}
        </Series.Sequence>

        {/* 新闻列表 */}
        {data.news.map((news, index) => {
          const newsDuration = news.duration * fps;
          const newsSfxOutFrame = Math.max(0, Math.floor(newsDuration - newsSfxOutFrameOffset));
          return (
            <Series.Sequence
              key={news.id}
              durationInFrames={newsDuration}
              offset={0}
            >
              <NewsCard
                news={news}
                theme={data.theme}
                durationInFrames={newsDuration}
                index={index}
              />
              {/* 每条新闻的语音播报 */}
              {news.audio && (
                <>
                  <Audio
                    src="https://remotion.media/whoosh.wav"
                    volume={SFX_VOL_IN}
                    startFrom={newsSfxInFrame}
                    endAt={newsSfxInFrame + newsSfxLenFrames}
                  />
                  <Audio src={news.audio} startFrom={0} volume={1} endAt={newsDuration} />
                  <Audio
                    src="https://remotion.media/page-turn.wav"
                    volume={SFX_VOL_OUT}
                    startFrom={newsSfxOutFrame}
                    endAt={newsSfxOutFrame + newsSfxLenFrames}
                  />
                </>
              )}
            </Series.Sequence>
          );
        })}

        {/* 片尾 */}
        <Series.Sequence durationInFrames={endingDuration} offset={0}>
          <EndingPage data={data} durationInFrames={endingDuration} />
          {data.endingAudio && (
            <>
              <Audio
                src="https://remotion.media/shutter-modern.wav"
                volume={SFX_VOL_IN}
                startFrom={endingSfxInFrame}
                endAt={endingSfxInFrame + sfxLenFrames}
              />
              <Audio src={data.endingAudio} startFrom={0} volume={1} endAt={endingDuration} />
              <Audio
                src="https://remotion.media/ding.wav"
                volume={SFX_VOL_OUT}
                startFrom={endingSfxOutFrame}
                endAt={endingSfxOutFrame + sfxLenFrames}
              />
            </>
          )}
        </Series.Sequence>
      </Series>
    </>
  );
};
