"use client";
import Image from "next/image";
import { useState } from "react";
import type { User } from "firebase/auth";
export function MemberAvatar({
  user,
  size = 34,
}: {
  user: Pick<User, "displayName" | "photoURL">;
  size?: number;
}) {
  const [failedPhoto, setFailedPhoto] = useState("");
  const photo = user.photoURL?.startsWith("https://") ? user.photoURL : "";
  const initials = (user.displayName || "Rider")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  return (
    <span
      className="member-avatar"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {photo && photo !== failedPhoto ? (
        <Image
          src={photo}
          alt=""
          width={size}
          height={size}
          unoptimized
          referrerPolicy="no-referrer"
          onError={() => setFailedPhoto(photo)}
        />
      ) : (
        initials || "R"
      )}
    </span>
  );
}
