/**
 * Tailwind CSS class utilities
 * Combines clsx for conditional classes with twMerge for conflict resolution.
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind CSS classes intelligently.
 * Handles conditional classes and resolves Tailwind conflicts.
 *
 * @example
 * cn("px-2 py-1", "px-4") // "py-1 px-4"
 * cn("px-2", { "px-4": true }) // "px-4"
 * cn("text-red-500", condition ? "text-blue-500" : "") // conditional merging
 *
 * @param inputs - Class values (strings, objects, arrays, etc.)
 * @returns Merged Tailwind class string
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
