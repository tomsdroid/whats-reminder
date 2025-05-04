// ./service/database
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

// DEFINE
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

// db
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// Export
module.exports = db;

