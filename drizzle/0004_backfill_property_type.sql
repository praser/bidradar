UPDATE offers SET property_type = split_part(description, ', ', 1) WHERE property_type = '';
