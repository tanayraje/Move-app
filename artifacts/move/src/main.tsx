import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { supabase } from './lib/supabase';


createRoot(document.getElementById("root")!).render(<App />);
