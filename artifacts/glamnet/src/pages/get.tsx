import { useEffect } from "react";
import { useLocation } from "wouter";

/**
 * Short invite link: /get?ref=CODE
 * Sends an invited artist straight to sign-up, set to Artist, with the
 * inviter's referral code kept.
 */
export default function Get() {
  const [, navigate] = useLocation();
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    const query = new URLSearchParams({ role: "artist", ...(ref ? { ref } : {}) });
    navigate(`/signup?${query.toString()}`, { replace: true });
  }, [navigate]);
  return null;
}
