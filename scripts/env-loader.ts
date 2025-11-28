/**
 * Environment variable loader for standalone scripts.
 * Import this FIRST in any script that needs database access.
 */
import { config } from 'dotenv'

config()
