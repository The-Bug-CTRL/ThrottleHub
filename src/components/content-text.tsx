"use client";
import { useState } from "react";
import { Play } from "lucide-react";
import { sharedVideo } from "@/lib/shared-video";
function VideoPreview({ url }: { url: string }) {
  const video = sharedVideo(url),
    [playing, setPlaying] = useState(false);
  if (!video) return null;
  return (
    <div className="shared-video">
      {playing ? (
        <iframe
          src={video.embedUrl}
          title={`${video.provider} video shared by a member`}
          loading="lazy"
          allow="encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <button
          type="button"
          className="button-secondary video-preview-button"
          onClick={() => setPlaying(true)}
        >
          <Play size={28} />
          <b>Watch on {video.provider}</b>
          <small>Load video</small>
        </button>
      )}
      <a href={url} target="_blank" rel="nofollow ugc noopener noreferrer">
        Open video on {video.provider}
      </a>
    </div>
  );
}
export function ContentText({ text }: { text: string }) {
  return (
    <div className="content-text">
      {text.split(/\n\s*\n/).map((paragraph, index) => (
        <div className="content-paragraph" key={index}>
          {paragraph.split(/(https:\/\/[^\s<>]+)/g).map((part, j) =>
            part.startsWith("https://") ? (
              sharedVideo(part) ? (
                <VideoPreview key={j} url={part} />
              ) : (
                <a
                  key={j}
                  href={part}
                  target="_blank"
                  rel="nofollow ugc noopener noreferrer"
                >
                  {part}
                </a>
              )
            ) : (
              <span key={j}>{part}</span>
            ),
          )}
        </div>
      ))}
    </div>
  );
}
