import { supabase } from './supabaseClient';

export interface Address {
  id: string;
  customerId: string;
  name: string;
  phone: string;
  governorate: string;
  city: string;
  street: string;
  building?: string;
  floor?: string;
  landmark?: string;
  isDefault: boolean;
  createdAt?: string;
}

export interface AddressInput {
  name: string;
  phone: string;
  governorate: string;
  city: string;
  street: string;
  building?: string;
  floor?: string;
  landmark?: string;
  isDefault: boolean;
}

/**
 * Normalizes an addresses table row into the Address interface.
 * Handles both new columns (name, governorate, street, etc.) and legacy schema columns.
 */
function normalizeAddressRow(row: any): Address {
  const firstName = row.first_name || '';
  const lastName = row.last_name || '';
  const fullNameFromLegacy = `${firstName} ${lastName}`.trim();

  // Try parsing building / floor / landmark from street_line2 if legacy schema was used
  let parsedBuilding = row.building || '';
  let parsedFloor = row.floor || '';
  let parsedLandmark = row.landmark || '';

  if (!parsedBuilding && row.street_line2) {
    const bldgMatch = row.street_line2.match(/Bldg:\s*([^,]+)/i);
    const floorMatch = row.street_line2.match(/Floor:\s*([^,]+)/i);
    const landmarkMatch = row.street_line2.match(/Near:\s*([^,]+)/i);
    if (bldgMatch) parsedBuilding = bldgMatch[1].trim();
    if (floorMatch) parsedFloor = floorMatch[1].trim();
    if (landmarkMatch) parsedLandmark = landmarkMatch[1].trim();
  }

  return {
    id: row.id,
    customerId: row.customer_id,
    name: row.name || fullNameFromLegacy || 'Valued Client',
    phone: row.phone || '',
    governorate: row.governorate || row.state || '',
    city: row.city || '',
    street: row.street || row.street_line1 || '',
    building: parsedBuilding || undefined,
    floor: parsedFloor || undefined,
    landmark: parsedLandmark || undefined,
    isDefault: Boolean(row.is_default),
    createdAt: row.created_at
  };
}

/**
 * Builds the database insert/update payload.
 * Supplies both modern and legacy columns to ensure maximum compatibility.
 */
function buildAddressPayload(userId: string, input: AddressInput) {
  const firstName = input.name.trim().split(/\s+/)[0] || input.name;
  const lastName = input.name.trim().split(/\s+/).slice(1).join(' ') || '.';
  
  const notesParts: string[] = [];
  if (input.building?.trim()) notesParts.push(`Bldg: ${input.building.trim()}`);
  if (input.floor?.trim()) notesParts.push(`Floor: ${input.floor.trim()}`);
  if (input.landmark?.trim()) notesParts.push(`Near: ${input.landmark.trim()}`);
  const combinedStreet2 = notesParts.join(', ') || null;

  return {
    customer_id: userId,
    name: input.name.trim(),
    phone: input.phone.trim(),
    governorate: input.governorate.trim(),
    city: input.city.trim(),
    street: input.street.trim(),
    building: input.building?.trim() || null,
    floor: input.floor?.trim() || null,
    landmark: input.landmark?.trim() || null,
    is_default: input.isDefault,
    // Legacy schema fallbacks to fulfill any non-null constraints
    first_name: firstName,
    last_name: lastName,
    street_line1: input.street.trim(),
    street_line2: combinedStreet2,
    state: input.governorate.trim(),
    postal_code: '00000',
    country: 'Egypt',
    address_type: 'shipping'
  };
}

/**
 * Strips new-schema columns in case database has not run the latest migration yet
 */
function buildLegacyOnlyPayload(userId: string, input: AddressInput) {
  const firstName = input.name.trim().split(/\s+/)[0] || input.name;
  const lastName = input.name.trim().split(/\s+/).slice(1).join(' ') || '.';
  
  const notesParts: string[] = [];
  if (input.building?.trim()) notesParts.push(`Bldg: ${input.building.trim()}`);
  if (input.floor?.trim()) notesParts.push(`Floor: ${input.floor.trim()}`);
  if (input.landmark?.trim()) notesParts.push(`Near: ${input.landmark.trim()}`);
  const combinedStreet2 = notesParts.join(', ') || null;

  return {
    customer_id: userId,
    phone: input.phone.trim(),
    is_default: input.isDefault,
    first_name: firstName,
    last_name: lastName,
    street_line1: input.street.trim(),
    street_line2: combinedStreet2,
    city: input.city.trim(),
    state: input.governorate.trim(),
    postal_code: '00000',
    country: 'Egypt',
    address_type: 'shipping'
  };
}

/**
 * Fetches all addresses for the authenticated user, ordered by is_default DESC, created_at DESC.
 */
export async function getUserAddresses(userId: string): Promise<Address[]> {
  if (!userId) return [];

  try {
    const { data, error } = await supabase
      .from('addresses')
      .select('*')
      .eq('customer_id', userId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('getUserAddresses error:', error.message);
      return [];
    }

    return (data || []).map(normalizeAddressRow);
  } catch (err) {
    console.warn('getUserAddresses exception:', err);
    return [];
  }
}

/**
 * Creates a new address for the user.
 * If isDefault is true or it's the user's first address, unsets default on other addresses.
 */
export async function createAddress(
  userId: string,
  input: AddressInput
): Promise<{ data: Address | null; error: string | null }> {
  if (!userId) return { data: null, error: 'User not authenticated' };

  try {
    // Check existing addresses count to decide if this must be default
    const existing = await getUserAddresses(userId);
    const shouldBeDefault = input.isDefault || existing.length === 0;

    if (shouldBeDefault) {
      await supabase
        .from('addresses')
        .update({ is_default: false })
        .eq('customer_id', userId);
    }

    const payload = buildAddressPayload(userId, { ...input, isDefault: shouldBeDefault });

    let { data, error } = await supabase
      .from('addresses')
      .insert(payload)
      .select()
      .single();

    // If an unknown column error occurs (migration not run yet), retry with legacy schema
    if (error && (error.message.includes('column') || error.code === '42703')) {
      console.warn('Retrying address insert with legacy column mapping...');
      const fallbackPayload = buildLegacyOnlyPayload(userId, { ...input, isDefault: shouldBeDefault });
      const fallbackRes = await supabase
        .from('addresses')
        .insert(fallbackPayload)
        .select()
        .single();
      data = fallbackRes.data;
      error = fallbackRes.error;
    }

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: normalizeAddressRow(data), error: null };
  } catch (err: any) {
    return { data: null, error: err.message || 'Failed to create address' };
  }
}

/**
 * Updates an existing address.
 * If isDefault is set, clears isDefault from all other addresses.
 */
export async function updateAddress(
  userId: string,
  addressId: string,
  input: AddressInput
): Promise<{ data: Address | null; error: string | null }> {
  if (!userId) return { data: null, error: 'User not authenticated' };

  try {
    if (input.isDefault) {
      await supabase
        .from('addresses')
        .update({ is_default: false })
        .eq('customer_id', userId);
    }

    const payload = buildAddressPayload(userId, input);

    let { data, error } = await supabase
      .from('addresses')
      .update(payload)
      .eq('id', addressId)
      .eq('customer_id', userId)
      .select()
      .single();

    if (error && (error.message.includes('column') || error.code === '42703')) {
      console.warn('Retrying address update with legacy column mapping...');
      const fallbackPayload = buildLegacyOnlyPayload(userId, input);
      const fallbackRes = await supabase
        .from('addresses')
        .update(fallbackPayload)
        .eq('id', addressId)
        .eq('customer_id', userId)
        .select()
        .single();
      data = fallbackRes.data;
      error = fallbackRes.error;
    }

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: normalizeAddressRow(data), error: null };
  } catch (err: any) {
    return { data: null, error: err.message || 'Failed to update address' };
  }
}

/**
 * Sets a given address as the default, unsetting all others.
 */
export async function setDefaultAddress(
  userId: string,
  addressId: string
): Promise<{ error: string | null }> {
  if (!userId) return { error: 'User not authenticated' };

  try {
    // 1. Reset all addresses for user
    const { error: resetError } = await supabase
      .from('addresses')
      .update({ is_default: false })
      .eq('customer_id', userId);

    if (resetError) return { error: resetError.message };

    // 2. Set target address as default
    const { error: setError } = await supabase
      .from('addresses')
      .update({ is_default: true })
      .eq('id', addressId)
      .eq('customer_id', userId);

    if (setError) return { error: setError.message };

    return { error: null };
  } catch (err: any) {
    return { error: err.message || 'Failed to set default address' };
  }
}

/**
 * Deletes an address. If the deleted address was default, marks the most recent remaining one as default.
 */
export async function deleteAddress(
  userId: string,
  addressId: string
): Promise<{ error: string | null }> {
  if (!userId) return { error: 'User not authenticated' };

  try {
    // Check if we are deleting the default address
    const { data: target } = await supabase
      .from('addresses')
      .select('is_default')
      .eq('id', addressId)
      .eq('customer_id', userId)
      .single();

    const wasDefault = Boolean(target?.is_default);

    const { error } = await supabase
      .from('addresses')
      .delete()
      .eq('id', addressId)
      .eq('customer_id', userId);

    if (error) return { error: error.message };

    // If it was default, promote the newest remaining address to default
    if (wasDefault) {
      const remaining = await getUserAddresses(userId);
      if (remaining.length > 0) {
        await setDefaultAddress(userId, remaining[0].id);
      }
    }

    return { error: null };
  } catch (err: any) {
    return { error: err.message || 'Failed to delete address' };
  }
}
