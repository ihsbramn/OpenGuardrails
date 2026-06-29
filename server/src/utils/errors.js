// Centralized error formatting with field-level details

class AppError extends Error {
  constructor(message, status = 400, code = 'ERROR', details = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      status: this.status,
      ...(this.details.length > 0 && { details: this.details }),
      ...(this.help && { help: this.help }),
    };
  }
}

// Map PostgreSQL error codes to human-readable messages
function pgError(err, resource = 'resource') {
  const detail = err.detail || '';

  switch (err.code) {
    case '23505': { // unique_violation
      // Parse the key from detail: 'Key (email)=(x@y.com) already exists.'
      const match = detail.match(/Key \((\w+)\)=\((.+?)\)/);
      if (match) {
        return new AppError(
          `A ${resource} with this ${match[1]} already exists.`,
          409,
          'UNIQUE_CONFLICT',
          [{ field: match[1], message: `Value "${match[2]}" is already taken`, value: match[2] }]
        );
      }
      return new AppError(`A ${resource} with this identifier already exists.`, 409, 'UNIQUE_CONFLICT');
    }

    case '23503': // foreign_key_violation
      return new AppError(
        'Referenced resource does not exist.',
        400,
        'REFERENCE_NOT_FOUND',
        [{ field: 'reference', message: 'The referenced item was not found — it may have been deleted' }]
      );

    case '23514': { // check_violation
      const m = detail.match(/violates check constraint "(\w+)"/);
      const constraint = m ? m[1] : 'constraint';
      return new AppError(
        `Value does not meet the ${constraint} requirement.`,
        400,
        'CHECK_VIOLATION',
        [{ field: constraint, message: `Must satisfy ${constraint} (${detail})` }]
      );
    }

    case '23502': // not_null_violation
      const colMatch = detail.match(/column "(\w+)"/);
      return new AppError(
        `Required field "${colMatch ? colMatch[1] : 'unknown'}" cannot be empty.`,
        400,
        'REQUIRED_FIELD',
        [{ field: colMatch ? colMatch[1] : 'unknown', message: 'This field is required' }]
      );

    case '22P02': // invalid_text_representation (e.g., invalid UUID)
      return new AppError('Invalid value format.', 400, 'INVALID_FORMAT');

    case '42601': // syntax_error
      return new AppError('Internal query error. Please try again.', 500, 'INTERNAL_ERROR');

    case '42P01': // undefined_table (relation already exists on migration)
      return new AppError(
        `Table already exists — migration may have been partially applied (${err.message})`,
        409,
        'ALREADY_EXISTS'
      );

    default:
      return new AppError(
        `Database error: ${detail || err.message}`,
        500,
        'DATABASE_ERROR'
      );
  }
}

// Validation helper — returns AppError if validation fails, null if OK
function validate(checks) {
  const details = [];
  for (const { field, value, rules } of checks) {
    for (const rule of rules) {
      if (rule.skip) continue;

      if (rule.required && (value === null || value === undefined || value === '')) {
        details.push({ field, message: `"${field}" is required` });
        break; // only one error per field
      }

      if (value && rule.pattern && !rule.pattern.test(value)) {
        details.push({ field, message: rule.message || `"${field}" has an invalid format` });
        break;
      }

      if (value && rule.oneOf && !rule.oneOf.includes(value)) {
        details.push({
          field,
          message: `"${field}" must be one of: ${rule.oneOf.join(', ')}`,
          value,
        });
        break;
      }

      if (value && rule.minLength && value.length < rule.minLength) {
        details.push({ field, message: `"${field}" must be at least ${rule.minLength} characters` });
        break;
      }

      if (value && rule.isUrl && !/^https?:\/\/.+/.test(value)) {
        details.push({ field, message: `"${field}" must be a valid http(s) URL` });
        break;
      }

      if (value && rule.isEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        details.push({ field, message: `"${field}" must be a valid email address` });
        break;
      }

      if (rule.custom) {
        const msg = rule.custom(value);
        if (msg) {
          details.push({ field, message: msg });
          break;
        }
      }
    }
  }

  if (details.length > 0) {
    const err = new AppError('Validation failed — fix the highlighted fields.', 400, 'VALIDATION_ERROR', details);
    err.help = 'Check the details array for field-level errors.';
    return err;
  }
  return null;
}

module.exports = { AppError, pgError, validate };
