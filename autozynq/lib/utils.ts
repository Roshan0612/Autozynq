import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { customAlphabet } from "nanoid"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Generate random IDs for webhook paths and trigger subscriptions
const nanoid = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 16);

export function generateRandomId(): string {
  return nanoid();}