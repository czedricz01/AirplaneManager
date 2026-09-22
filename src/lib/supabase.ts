/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Export the supabase client ONLY if the user has provided the environment variables.
// If the variables are missing, supabase will be null, and we can gracefully downgrade
// or show them instructions without breaking compile_applet.

let finalUrl = supabaseUrl;
if (finalUrl) {
  // If user just pasted the project ref, construct the full URL
  if (!finalUrl.includes('.') && finalUrl.length === 20) {
    finalUrl = `https://${finalUrl}.supabase.co`;
  } else if (!finalUrl.startsWith('http')) {
    finalUrl = `https://${finalUrl}`;
  }
}

export const supabase = (finalUrl && supabaseAnonKey) 
  ? createClient(finalUrl, supabaseAnonKey, {
      auth: {
        // Use a distinct storage key to avoid mixed-up local storage
        storageKey: 'aero-empire-auth-token',
        // Optional: you can turn off standard detection if lock errors persist, 
        // but default is usually fine if we don't double-call blindly.
      }
    }) 
  : null;
