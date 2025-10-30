/**
 * Client-side CSV validation
 * 
 * This module provides CSV validation that runs in the browser BEFORE uploading.
 * It replicates the server-side validation logic from csv-utils.ts but without
 * Prisma dependencies.
 */

import { parse } from 'csv-parse/sync';

export interface ValidationResult {
  valid: boolean;
  error?: string;
  rowCount?: number;
  details?: string;
}

// Column mapping: MOH CSV columns → our internal columns
const COLUMN_MAPPINGS: Record<string, string> = {
  'id': 'external_id',
  'name_ar_raw': 'name',
  'name_en': 'name_english',
  'sex': 'gender',
  'dob': 'date_of_birth',
};

// These are the normalized internal column names we expect
const REQUIRED_COLUMNS = ['external_id', 'name', 'gender', 'date_of_birth'];

// Optional columns that can be present but we'll ignore
const OPTIONAL_IGNORED_COLUMNS = ['index', 'age', 'source'];

const FORBIDDEN_COLUMNS = ['date_of_death', 'location_of_death', 'obituary'];

/**
 * Validate CSV content on the client side
 * Returns validation result with error details if invalid
 */
export function validateCSVContent(csvContent: string): ValidationResult {
  try {
    // 1. Check if empty
    if (!csvContent || csvContent.trim().length === 0) {
      return {
        valid: false,
        error: 'CSV file is empty',
        details: 'The file contains no data. Please check that you selected the correct file.'
      };
    }

    // 2. Parse CSV structure
    let records: Record<string, string>[];
    try {
      records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relaxColumnCount: false, // Strict: all rows must have same column count
        relax_quotes: true, // Allow malformed quotes (MOH CSVs have some quote issues)
        escape: '"',
        quote: '"',
      });
    } catch (error) {
      return {
        valid: false,
        error: 'CSV parsing failed',
        details: error instanceof Error ? error.message : 'Invalid CSV format. Check for malformed quotes or inconsistent column counts.'
      };
    }

    if (records.length === 0) {
      return {
        valid: false,
        error: 'CSV file contains no data rows',
        details: 'The file has headers but no data rows. Expected at least one record.'
      };
    }

    // 3. Validate headers
    const originalHeaders = Object.keys(records[0]).map(h => h.trim().toLowerCase());
    const headerValidation = validateHeaders(originalHeaders);
    if (!headerValidation.valid) {
      return headerValidation;
    }

    // 4. Validate each row
    const externalIds: string[] = [];
    
    for (let i = 0; i < records.length; i++) {
      const rowNumber = i + 2; // +2 because row 1 is headers, and array is 0-indexed
      const record = records[i];
      
      // Normalize keys to lowercase and map to internal column names
      const row: Record<string, string> = {};
      Object.keys(record).forEach(key => {
        const normalizedKey = key.trim().toLowerCase();
        const mappedKey = COLUMN_MAPPINGS[normalizedKey] || normalizedKey;
        row[mappedKey] = record[key];
      });
      
      // Validate required fields
      for (const field of REQUIRED_COLUMNS) {
        const value = row[field];
        
        // Allow empty date_of_birth (some MOH records don't have DOB)
        if (field === 'date_of_birth') {
          if (value === undefined || value === null) {
            row[field] = ''; // Set to empty string
          }
          continue;
        }
        
        if (value === undefined || value === null || value.trim() === '') {
          return {
            valid: false,
            error: `Row ${rowNumber}: Missing required field "${field}"`,
            details: 'All fields except date_of_birth are required and cannot be empty.'
          };
        }
      }
      
      // Validate gender
      const genderValue = row.gender.trim().toUpperCase();
      if (!['M', 'MALE', 'F', 'FEMALE', 'O', 'OTHER'].includes(genderValue)) {
        return {
          valid: false,
          error: `Row ${rowNumber}: Invalid gender "${row.gender}"`,
          details: 'Gender must be M/F/O or MALE/FEMALE/OTHER (case-insensitive).'
        };
      }
      
      // Validate date format if provided
      const dobValue = row.date_of_birth.trim();
      if (dobValue && !isValidDate(dobValue)) {
        return {
          valid: false,
          error: `Row ${rowNumber}: Invalid date_of_birth "${dobValue}"`,
          details: 'Date must be in YYYY-MM-DD or MM/DD/YYYY format (e.g., 1990-12-25 or 12/25/1990) or empty.'
        };
      }
      
      // Validate external_id format
      const externalId = row.external_id.trim();
      if (externalId.length === 0) {
        return {
          valid: false,
          error: `Row ${rowNumber}: external_id cannot be empty`,
          details: 'The ID field (external_id) cannot be empty or contain only whitespace.'
        };
      }
      if (externalId.length > 50) {
        return {
          valid: false,
          error: `Row ${rowNumber}: external_id too long`,
          details: `Maximum 50 characters allowed, got ${externalId.length} characters.`
        };
      }
      if (!/^[A-Za-z0-9_-]+$/.test(externalId)) {
        return {
          valid: false,
          error: `Row ${rowNumber}: external_id "${externalId}" contains invalid characters`,
          details: 'Only letters, numbers, hyphens, and underscores are allowed.'
        };
      }
      
      // Validate name is not just whitespace
      if (row.name.trim().length === 0) {
        return {
          valid: false,
          error: `Row ${rowNumber}: name cannot be empty`,
          details: 'Name field cannot be empty or contain only whitespace.'
        };
      }
      
      // Collect external IDs for duplicate check
      externalIds.push(externalId);
    }
    
    // 5. Check for duplicate external_ids
    const duplicateIds = externalIds.filter((id, index) => externalIds.indexOf(id) !== index);
    if (duplicateIds.length > 0) {
      const uniqueDuplicates = [...new Set(duplicateIds)];
      return {
        valid: false,
        error: `Duplicate external_id field${uniqueDuplicates.length > 1 ? 's' : ''}`,
        details: `Found duplicate IDs: ${uniqueDuplicates.slice(0, 5).join(', ')}${uniqueDuplicates.length > 5 ? ` and ${uniqueDuplicates.length - 5} more` : ''}`
      };
    }
    
    // All validations passed!
    return {
      valid: true,
      rowCount: records.length
    };
    
  } catch (error) {
    return {
      valid: false,
      error: 'Validation failed',
      details: error instanceof Error ? error.message : 'An unexpected error occurred during validation.'
    };
  }
}

function validateHeaders(headers: string[]): ValidationResult {
  if (headers.length === 0) {
    return {
      valid: false,
      error: 'CSV file has no headers',
      details: 'Expected headers: id, name_ar_raw, sex, dob'
    };
  }

  // Map headers to internal column names
  const mappedHeaders = headers.map(h => COLUMN_MAPPINGS[h] || h);
  
  // Check for required columns (after mapping)
  const missingColumns = REQUIRED_COLUMNS.filter(col => !mappedHeaders.includes(col));
  if (missingColumns.length > 0) {
    // Provide helpful error message with original column names
    const missingOriginal: string[] = [];
    for (const col of missingColumns) {
      const originalName = Object.keys(COLUMN_MAPPINGS).find(k => COLUMN_MAPPINGS[k] === col);
      missingOriginal.push(originalName || col);
    }
    
    return {
      valid: false,
      error: `Missing required column(s): ${missingOriginal.join(', ')}`,
      details: `Your CSV headers: ${headers.join(', ')}\nRequired headers: id, name_ar_raw, sex, dob`
    };
  }
  
  // Check for forbidden columns
  const forbiddenFound = headers.filter(col => FORBIDDEN_COLUMNS.includes(col));
  if (forbiddenFound.length > 0) {
    return {
      valid: false,
      error: `CSV contains forbidden column(s): ${forbiddenFound.join(', ')}`,
      details: 'Death-related fields cannot be included in bulk uploads.\nRequired headers: id, name_ar_raw, sex, dob (optional: name_en, index, age, source)'
    };
  }
  
  // Check for extra columns (allow optional columns)
  const allowedColumns = [
    ...Object.keys(COLUMN_MAPPINGS), // Original MOH column names
    ...OPTIONAL_IGNORED_COLUMNS,
  ];
  
  const extraColumns = headers.filter(col => !allowedColumns.includes(col));
  if (extraColumns.length > 0) {
    return {
      valid: false,
      error: `CSV contains unexpected column(s): ${extraColumns.join(', ')}`,
      details: `Required: id, name_ar_raw, sex, dob\nOptional: name_en, ${OPTIONAL_IGNORED_COLUMNS.join(', ')}\nRemove the extra columns and try again.`
    };
  }
  
  // Check for duplicate columns
  const duplicates = headers.filter((col, index) => headers.indexOf(col) !== index);
  if (duplicates.length > 0) {
    return {
      valid: false,
      error: `CSV contains duplicate column(s): ${[...new Set(duplicates)].join(', ')}`,
      details: 'Each column header must be unique.'
    };
  }
  
  return { valid: true };
}

function isValidDate(dateString: string): boolean {
  // Support YYYY-MM-DD format
  const isoRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (isoRegex.test(dateString)) {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  }
  
  // Support MM/DD/YYYY format
  const usRegex = /^\d{2}\/\d{2}\/\d{4}$/;
  if (usRegex.test(dateString)) {
    const [month, day, year] = dateString.split('/');
    const isoDate = `${year}-${month}-${day}`;
    const date = new Date(isoDate);
    return date instanceof Date && !isNaN(date.getTime());
  }
  
  return false;
}

