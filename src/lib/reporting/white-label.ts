// ============================================================================
// White-Label Profile Manager — SEOCoach
// AI-Driven SEO Automation Platform (Dutch Market)
// ============================================================================
// Manages white-label profiles for organizations, allowing agencies to
// brand reports with their own logo, colors, fonts, and company details.
// Includes an HTML transformation function that applies white-label
// branding to report HTML output.
// ============================================================================

import { db } from '@/lib/db';
import type { WhiteLabelProfileData } from './types';

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Create a new white-label profile for an organization.
 *
 * If `isDefault` is true, any existing default profile for the same
 * organization will have its default flag removed first.
 *
 * @param organizationId - The organization to create the profile for
 * @param data - White-label profile data
 * @returns The created WhiteLabelProfile record
 */
export async function createWhiteLabelProfile(
  organizationId: string,
  data: WhiteLabelProfileData,
) {
  // If this is set as default, unset any existing default
  if (data.isDefault) {
    await db.whiteLabelProfile.updateMany({
      where: {
        organizationId,
        isDefault: true,
        deletedAt: null,
      },
      data: { isDefault: false },
    });
  }

  return db.whiteLabelProfile.create({
    data: {
      organizationId,
      name: data.name,
      logoUrl: data.logoUrl || null,
      primaryColor: data.primaryColor || '#059669',
      secondaryColor: data.secondaryColor || null,
      accentColor: data.accentColor || null,
      fontFamily: data.fontFamily || null,
      companyName: data.companyName || null,
      companyTagline: data.companyTagline || null,
      companyAddress: data.companyAddress || null,
      companyPhone: data.companyPhone || null,
      companyEmail: data.companyEmail || null,
      companyWebsite: data.companyWebsite || null,
      companyKvk: data.companyKvk || null,
      introductionText: data.introductionText || null,
      closingText: data.closingText || null,
      footerText: data.footerText || null,
      senderIdentity: data.senderIdentity || null,
      isDefault: data.isDefault ?? false,
    },
  });
}

/**
 * Update a white-label profile's branding and company details.
 *
 * If `isDefault` is being set to true, any existing default profile
 * for the same organization will have its default flag removed first.
 *
 * @param profileId - The profile ID to update
 * @param updates - The fields to update
 * @returns The updated WhiteLabelProfile record
 */
export async function updateWhiteLabelProfile(
  profileId: string,
  updates: Partial<WhiteLabelProfileData>,
) {
  // If setting as default, unset any existing default for this org
  if (updates.isDefault) {
    const profile = await db.whiteLabelProfile.findUnique({
      where: { id: profileId },
      select: { organizationId: true },
    });

    if (profile) {
      await db.whiteLabelProfile.updateMany({
        where: {
          organizationId: profile.organizationId,
          isDefault: true,
          deletedAt: null,
        },
        data: { isDefault: false },
      });
    }
  }

  const data: Record<string, unknown> = {};
  if (updates.name !== undefined) data.name = updates.name;
  if (updates.logoUrl !== undefined) data.logoUrl = updates.logoUrl;
  if (updates.primaryColor !== undefined) data.primaryColor = updates.primaryColor;
  if (updates.secondaryColor !== undefined) data.secondaryColor = updates.secondaryColor;
  if (updates.accentColor !== undefined) data.accentColor = updates.accentColor;
  if (updates.fontFamily !== undefined) data.fontFamily = updates.fontFamily;
  if (updates.companyName !== undefined) data.companyName = updates.companyName;
  if (updates.companyTagline !== undefined) data.companyTagline = updates.companyTagline;
  if (updates.companyAddress !== undefined) data.companyAddress = updates.companyAddress;
  if (updates.companyPhone !== undefined) data.companyPhone = updates.companyPhone;
  if (updates.companyEmail !== undefined) data.companyEmail = updates.companyEmail;
  if (updates.companyWebsite !== undefined) data.companyWebsite = updates.companyWebsite;
  if (updates.companyKvk !== undefined) data.companyKvk = updates.companyKvk;
  if (updates.introductionText !== undefined) data.introductionText = updates.introductionText;
  if (updates.closingText !== undefined) data.closingText = updates.closingText;
  if (updates.footerText !== undefined) data.footerText = updates.footerText;
  if (updates.senderIdentity !== undefined) data.senderIdentity = updates.senderIdentity;
  if (updates.isDefault !== undefined) data.isDefault = updates.isDefault;

  return db.whiteLabelProfile.update({
    where: { id: profileId },
    data,
  });
}

/**
 * Get all white-label profiles for an organization.
 * Returns only non-deleted profiles.
 *
 * @param organizationId - The organization to get profiles for
 * @returns Array of WhiteLabelProfile records
 */
export async function getWhiteLabelProfiles(
  organizationId: string,
) {
  return db.whiteLabelProfile.findMany({
    where: {
      organizationId,
      deletedAt: null,
    },
    orderBy: [
      { isDefault: 'desc' },
      { name: 'asc' },
    ],
  });
}

/**
 * Get the default white-label profile for an organization.
 * Returns null if no default profile exists.
 *
 * @param organizationId - The organization to get the default profile for
 * @returns The default WhiteLabelProfile or null
 */
export async function getDefaultProfile(
  organizationId: string,
) {
  return db.whiteLabelProfile.findFirst({
    where: {
      organizationId,
      isDefault: true,
      deletedAt: null,
    },
  });
}

// ============================================================================
// HTML White-Labeling
// ============================================================================

/**
 * White-label profile as returned from the database, used for HTML transformation.
 */
interface WhiteLabelProfileRecord {
  id: string;
  organizationId: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  fontFamily: string | null;
  companyName: string | null;
  companyTagline: string | null;
  companyAddress: string | null;
  companyPhone: string | null;
  companyEmail: string | null;
  companyWebsite: string | null;
  companyKvk: string | null;
  introductionText: string | null;
  closingText: string | null;
  footerText: string | null;
  senderIdentity: string | null;
  isDefault: boolean;
}

/**
 * Apply white-label branding to an HTML report output.
 *
 * This function:
 * - Injects custom CSS variables for colors and fonts
 * - Replaces or adds a logo in the header
 * - Adds company details (name, address, KvK, etc.)
 * - Inserts intro/closing text around the report body
 * - Adds a footer with sender identity
 *
 * If the profile is null or has minimal data, the original HTML is returned
 * with only minor structural adjustments.
 *
 * @param html - The raw report HTML
 * @param profile - The white-label profile to apply (or null for no branding)
 * @returns The branded HTML string
 */
export function applyWhiteLabeling(
  html: string,
  profile: WhiteLabelProfileRecord | null,
): string {
  if (!profile) return html;

  const primaryColor = profile.primaryColor || '#059669';
  const secondaryColor = profile.secondaryColor || '#1f2937';
  const accentColor = profile.accentColor || '#10b981';
  const fontFamily = profile.fontFamily || 'Inter, system-ui, sans-serif';

  // Build CSS custom properties for branding
  const brandCSS = `
    :root {
      --wl-primary: ${primaryColor};
      --wl-secondary: ${secondaryColor};
      --wl-accent: ${accentColor};
      --wl-font-family: ${fontFamily};
    }
    .report-header { border-bottom: 3px solid var(--wl-primary); }
    .report-header h1 { color: var(--wl-primary); }
    .kpi-card { border-left: 4px solid var(--wl-primary); }
    .section-title { color: var(--wl-primary); }
    .recommendation-item { border-left: 3px solid var(--wl-accent); }
    .report-body { font-family: var(--wl-font-family); }
  `;

  // Build logo HTML
  const logoHtml = profile.logoUrl
    ? `<img src="${escapeHtml(profile.logoUrl)}" alt="${escapeHtml(profile.companyName || 'Logo')}" style="max-height:60px;max-width:200px;" />`
    : '';

  // Build company details block
  const companyDetailsParts: string[] = [];
  if (profile.companyName) companyDetailsParts.push(`<strong>${escapeHtml(profile.companyName)}</strong>`);
  if (profile.companyTagline) companyDetailsParts.push(`<span style="color:#6b7280;font-style:italic;">${escapeHtml(profile.companyTagline)}</span>`);
  if (profile.companyAddress) companyDetailsParts.push(escapeHtml(profile.companyAddress));
  const contactParts: string[] = [];
  if (profile.companyPhone) contactParts.push(escapeHtml(profile.companyPhone));
  if (profile.companyEmail) contactParts.push(`<a href="mailto:${escapeHtml(profile.companyEmail)}">${escapeHtml(profile.companyEmail)}</a>`);
  if (profile.companyWebsite) contactParts.push(`<a href="${escapeHtml(profile.companyWebsite)}">${escapeHtml(profile.companyWebsite)}</a>`);
  if (contactParts.length > 0) companyDetailsParts.push(contactParts.join(' | '));
  if (profile.companyKvk) companyDetailsParts.push(`KvK: ${escapeHtml(profile.companyKvk)}`);

  const companyDetailsHtml = companyDetailsParts.length > 0
    ? `<div class="company-details" style="margin-bottom:20px;font-size:14px;line-height:1.6;">${companyDetailsParts.join('<br/>')}</div>`
    : '';

  // Build intro text
  const introHtml = profile.introductionText
    ? `<div class="report-intro" style="margin-bottom:24px;padding:16px;background:#f9fafb;border-radius:8px;font-style:italic;">${escapeHtml(profile.introductionText)}</div>`
    : '';

  // Build closing text
  const closingHtml = profile.closingText
    ? `<div class="report-closing" style="margin-top:24px;padding:16px;background:#f9fafb;border-radius:8px;font-style:italic;">${escapeHtml(profile.closingText)}</div>`
    : '';

  // Build footer with sender identity
  const footerParts: string[] = [];
  if (profile.senderIdentity) footerParts.push(escapeHtml(profile.senderIdentity));
  if (profile.companyName) footerParts.push(`© ${new Date().getFullYear()} ${escapeHtml(profile.companyName)}`);
  if (profile.footerText) footerParts.push(escapeHtml(profile.footerText));

  const footerHtml = footerParts.length > 0
    ? `<div class="report-footer" style="margin-top:40px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;">${footerParts.join(' — ')}</div>`
    : '';

  // Assemble the final HTML
  const brandedHtml = `
    <div class="report-body">
      <style>${brandCSS}</style>
      <div class="report-header" style="display:flex;align-items:center;justify-content:space-between;padding-bottom:16px;margin-bottom:24px;">
        <div>${logoHtml}</div>
        <div style="text-align:right;">${companyDetailsHtml}</div>
      </div>
      ${introHtml}
      <div class="report-content">
        ${html}
      </div>
      ${closingHtml}
      ${footerHtml}
    </div>
  `;

  return brandedHtml;
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Escape HTML special characters to prevent XSS.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
