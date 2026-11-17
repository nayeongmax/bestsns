// Preview eligibility is independent of whether the production worker is enabled.
function compatible(preset, video) {
 if (!video || video.embeddable !== true || !/^[A-Za-z0-9_-]{11}$/.test(video.videoId)) return false;
 if (!(video.width > 0 && video.height > 0 && video.duration > 0)) return false;
 return preset.format === 'short'
  ? video.height > video.width && video.duration <= 180
  : video.width > video.height;
}

function buildCatalog(source, references, policy = {}) {
 return {...source, items: source.items.map(preset => {
  if (preset.previewUrl) return {...preset, previewStatus: 'ready'};
  const reason = policy.pendingReasons?.[preset.id];
  if (reason) return {...preset, previewStatus: 'pending', previewReason: reason};
  const aliasId = policy.sampleAliases?.[preset.id];
  const sample = source.items.find(p => p.id === aliasId);
  if (sample?.previewUrl && sample.format === preset.format) {
   return {...preset, previewUrl: sample.previewUrl, thumbnail: sample.thumbnail,
    previewStatus: 'ready', sampleSourceName: sample.name};
  }
  const youtube = references[preset.id];
  if (compatible(preset, youtube)) return {...preset, youtube,
   thumbnail: 'https://i.ytimg.com/vi/' + youtube.videoId + '/hqdefault.jpg', previewStatus: 'ready'};
  return {...preset, previewStatus: 'pending', previewReason: '주제와 화면 비율이 맞는 재생 샘플 확인 필요'};
 })};
}
module.exports = {compatible, buildCatalog};
