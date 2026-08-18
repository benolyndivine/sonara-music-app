import React from 'react';

export default function MiniPlayer({ currentTrack, isPlaying, onTogglePlay, onNext, onPrev, onExpand }) {
  if (!currentTrack) return null;

  const resolvedImgSrc = currentTrack.cover || currentTrack.image || currentTrack.imageUrl;
  const resolvedTitle = currentTrack.title || currentTrack.name;

  return (
    <div className="mini-player" onClick={onExpand} style={{ cursor: 'pointer' }}>
      
      {/* 🛠️ FIXED: Stops the click from bubbling up to global layout click handlers or double-firing */}
      <div 
        className="mini-player-track-info" 
        onClick={(e) => {
          e.stopPropagation(); 
          onExpand();
        }}
      >
        <img src={resolvedImgSrc} alt={resolvedTitle} className="mini-player-thumb" />
        <div className="mini-player-details">
          <h4>{resolvedTitle}</h4>
          <p>{currentTrack.artist}</p>
        </div>
      </div>

      {/* Control buttons keep their click isolation to prevent expanding the player view */}
      <div className="mini-player-controls" onClick={(e) => e.stopPropagation()}>
        <button className="control-btn" onClick={onPrev} title="Previous track">
          <i className="fa-solid fa-backward-step"></i>
        </button>

        <button className="control-btn play-pause-main-btn" onClick={onTogglePlay} title={isPlaying ? "Pause" : "Play"}>
          {isPlaying ? (
            <i className="fa-solid fa-pause"></i>
          ) : (
            <i className="fa-solid fa-play"></i>
          )}
        </button>

        <button className="control-btn" onClick={onNext} title="Next track">
          <i className="fa-solid fa-forward-step"></i>
        </button>
      </div>
    </div>
  );
}