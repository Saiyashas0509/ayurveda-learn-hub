import { getRequest } from "@tanstack/react-start/server";

// Resolves the site origin (e.g. https://learn.travancoreayurveda.com) from
// the current request, for building redirect URLs used in auth emails
// (password reset / invite links) sent from server functions.
export function getSiteOrigin(): string {
  const request = getRequest();
  if (request?.url) {
    try {
      return new URL(request.url).origin;
    } catch {
      // fall through
    }
  }
  return process.env.SITE_URL ?? "http://localhost:3000";
}
