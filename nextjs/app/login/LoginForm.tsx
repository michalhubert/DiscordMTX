"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useState, SyntheticEvent } from "react";

export default function LoginForm({ discordEnabled }: { discordEnabled: boolean }) {
  const searchParams = useSearchParams();
  const isStreamerMode = searchParams.get("mode") === "streamer";
  const callbackUrl = searchParams.get("callbackUrl") ?? (isStreamerMode ? "/dock" : "/");
  const originUrl = searchParams.get("originUrl");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: SyntheticEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn(
      isStreamerMode ? "streamer-password" : "viewer-password",
      { password, redirect: false }
    );
    setLoading(false);
    if (res?.error) {
      setError("Invalid password. Try again.");
    } else {
      window.location.href = originUrl ? `${originUrl}${callbackUrl}` : callbackUrl;
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full max-w-sm shadow-2xl">
        <div className="flex items-center gap-3 mb-8">
          <span className="text-red-500 text-2xl">🔴</span>
          <h1 className="text-white text-xl font-semibold tracking-tight">
            DiscordMTX{isStreamerMode ? " — Streamer" : ""}
          </h1>
        </div>

        {!isStreamerMode && discordEnabled && (
          <button
            onClick={() => signIn("discord", { callbackUrl: originUrl ? `${originUrl}${callbackUrl}` : callbackUrl })}
            className="w-full flex items-center justify-center gap-2 bg-[#5865F2] hover:bg-[#4752C4] text-white font-medium rounded-lg py-2.5 text-sm transition-colors mb-4"
          >
            Sign in with Discord
          </button>
        )}

        {!isStreamerMode && discordEnabled && (
          <div className="relative flex items-center my-4">
            <div className="flex-grow border-t border-gray-700" />
            <span className="mx-3 text-gray-500 text-xs">or</span>
            <div className="flex-grow border-t border-gray-700" />
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-400 text-sm mb-1">
              {isStreamerMode ? "Streamer Password" : "Viewer Password"}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isStreamerMode ? "Enter streamer password" : "Enter stream password"}
              required
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-red-500 transition-colors"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-500 disabled:bg-red-900 text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
          >
            {loading ? "Signing in…" : isStreamerMode ? "Open Dock" : "Watch Stream"}
          </button>
        </form>

        {!isStreamerMode && (
          <p className="mt-6 text-center text-xs text-gray-600">
            Don&apos;t have Discord? Ask the streamer for the viewer password.
          </p>
        )}
      </div>
    </div>
  );
}
