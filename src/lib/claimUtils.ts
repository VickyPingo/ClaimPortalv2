import jsPDF from 'jspdf';
import JSZip from 'jszip';

export async function generateClaimPDF(claim: any): Promise<Blob> {
  const doc = new jsPDF();
  let y = 20;
  const lineHeight = 7;
  const pageHeight = doc.internal.pageSize.height;

  const addText = (text: string, isBold = false) => {
    if (y > pageHeight - 20) {
      doc.addPage();
      y = 20;
    }
    if (isBold) {
      doc.setFont('helvetica', 'bold');
    } else {
      doc.setFont('helvetica', 'normal');
    }
    doc.text(text, 20, y);
    y += lineHeight;
  };

  const formatKey = (key: string): string => {
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T/)) {
      return new Date(value).toLocaleString();
    }
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
  };

  const addDynamicData = (data: any, sectionTitle: string) => {
    if (!data || typeof data !== 'object') return;

    addText(sectionTitle.toUpperCase(), true);
    y += 2;

    const skipKeys = ['id', 'brokerage_id', 'client_id', 'user_id', 'created_at', 'updated_at', 'claim_data', 'claimant_snapshot'];

    Object.entries(data).forEach(([key, value]) => {
      if (skipKeys.includes(key)) return;
      if (value === null || value === undefined || value === '') return;
      if (key.toLowerCase().includes('url') || key.toLowerCase().includes('photo')) return;

      if (Array.isArray(value)) {
        if (value.length === 0) return;
        if (typeof value[0] === 'string' && value[0].startsWith('http')) return;

        if (typeof value[0] === 'object') {
          addText(`${formatKey(key)}:`, true);
          value.forEach((item, index) => {
            addText(`  Item ${index + 1}:`, true);
            Object.entries(item).forEach(([itemKey, itemValue]) => {
              const lines = doc.splitTextToSize(`    ${formatKey(itemKey)}: ${formatValue(itemValue)}`, 170);
              lines.forEach((line: string) => {
                if (y > pageHeight - 20) {
                  doc.addPage();
                  y = 20;
                }
                doc.text(line, 20, y);
                y += lineHeight;
              });
            });
          });
        } else {
          const lines = doc.splitTextToSize(`${formatKey(key)}: ${value.join(', ')}`, 170);
          lines.forEach((line: string) => {
            if (y > pageHeight - 20) {
              doc.addPage();
              y = 20;
            }
            doc.text(line, 20, y);
            y += lineHeight;
          });
        }
      } else if (typeof value === 'object') {
        addText(`${formatKey(key)}:`, true);
        Object.entries(value).forEach(([subKey, subValue]) => {
          if (subValue === null || subValue === undefined || subValue === '') return;
          const lines = doc.splitTextToSize(`  ${formatKey(subKey)}: ${formatValue(subValue)}`, 170);
          lines.forEach((line: string) => {
            if (y > pageHeight - 20) {
              doc.addPage();
              y = 20;
            }
            doc.text(line, 20, y);
            y += lineHeight;
          });
        });
      } else {
        const lines = doc.splitTextToSize(`${formatKey(key)}: ${formatValue(value)}`, 170);
        lines.forEach((line: string) => {
          if (y > pageHeight - 20) {
            doc.addPage();
            y = 20;
          }
          doc.text(line, 20, y);
          y += lineHeight;
        });
      }
    });
    y += 3;
  };

  doc.setFontSize(20);
  addText('Insurance Claim Report', true);
  y += 5;

  doc.setFontSize(12);
  addText(`Reference: ${claim.id.slice(0, 8)}`, true);
  addText(`Date: ${new Date(claim.created_at).toLocaleString()}`);
  y += 5;

  addText('CLAIMANT INFORMATION', true);
  y += 2;
  addText(`Name: ${claim.claimant_name || claim.claimant_email || 'Client'}`);
  addText(`Phone: ${claim.claimant_phone || 'N/A'}`);
  addText(`Email: ${claim.claimant_email || 'N/A'}`);
  if (claim.policy_number) {
    addText(`Policy Number: ${claim.policy_number}`);
  }
  y += 3;

  addText('CLAIM DETAILS', true);
  y += 2;
  addText(`Incident Type: ${claim.incident_type?.replace('_', ' ').toUpperCase() || 'N/A'}`);
  addText(`Status: ${claim.status?.toUpperCase() || 'N/A'}`);
  y += 3;

  if (claim.claim_data && Object.keys(claim.claim_data).length > 0) {
    addDynamicData(claim.claim_data, 'Complete Claim Data');
  }

  if (claim.location_address) {
    addText('LOCATION', true);
    y += 2;
    addText(`Address: ${claim.location_address}`);
    if (claim.location_lat && claim.location_lng) {
      addText(`Coordinates: ${claim.location_lat}, ${claim.location_lng}`);
    }
    y += 3;
  }

  if (claim.incident_type === 'motor_accident') {
    addText('MOTOR ACCIDENT DETAILS', true);
    y += 2;
    if (claim.accident_date_time) {
      addText(`Accident Date/Time: ${new Date(claim.accident_date_time).toLocaleString()}`);
    }
    if (claim.car_condition) {
      addText(`Car Condition: ${claim.car_condition}`);
    }
    if (claim.panel_beater_location) {
      addText(`Panel Beater Location: ${claim.panel_beater_location}`);
    }
    y += 3;

    if (claim.third_party_details) {
      addText('THIRD PARTY DETAILS', true);
      y += 2;
      const thirdParty = claim.third_party_details;
      if (thirdParty.name) {
        addText(`Name: ${thirdParty.name}`);
      }
      if (thirdParty.phone) {
        addText(`Phone: ${thirdParty.phone}`);
      }
      if (thirdParty.email) {
        addText(`Email: ${thirdParty.email}`);
      }
      if (thirdParty.vehicle) {
        addText(`Vehicle: ${thirdParty.vehicle}`);
      }
      if (thirdParty.registration) {
        addText(`Registration: ${thirdParty.registration}`);
      }
      if (thirdParty.insurance) {
        addText(`Insurance: ${thirdParty.insurance}`);
      }
      y += 3;
    }
  }

  if (claim.incident_type === 'burst_geyser') {
    addText('BURST GEYSER DETAILS', true);
    y += 2;
    if (claim.burst_datetime) {
      addText(`Burst Date/Time: ${new Date(claim.burst_datetime).toLocaleString()}`);
    }
    if (claim.geyser_type) {
      addText(`Geyser Type: ${claim.geyser_type}`);
    }
    if (claim.has_resulting_damage !== null) {
      addText(`Has Resulting Damage: ${claim.has_resulting_damage ? 'Yes' : 'No'}`);
    }
    y += 3;
  }

  if (claim.incident_type === 'theft_claim' || claim.incident_type === 'motor_vehicle_theft') {
    addText('THEFT DETAILS', true);
    y += 2;
    if (claim.theft_type) {
      addText(`Theft Type: ${claim.theft_type}`);
    }
    if (claim.police_station) {
      addText(`Police Station: ${claim.police_station}`);
    }
    if (claim.case_number) {
      addText(`Case Number: ${claim.case_number}`);
    }
    if (claim.vehicle_make) {
      addText(`Vehicle: ${claim.vehicle_make} ${claim.vehicle_model || ''} ${claim.vehicle_year || ''}`);
    }
    if (claim.vehicle_registration) {
      addText(`Registration: ${claim.vehicle_registration}`);
    }
    y += 3;
  }

  if (claim.incident_type === 'structural_damage') {
    addText('STRUCTURAL DAMAGE DETAILS', true);
    y += 2;
    if (claim.damage_type) {
      addText(`Damage Type: ${claim.damage_type}`);
    }
    if (claim.damage_description) {
      addText(`Description: ${claim.damage_description}`);
    }
    y += 3;
  }

  if (claim.incident_type === 'all_risk') {
    addText('ALL-RISK DETAILS', true);
    y += 2;
    if (claim.item_description) {
      addText(`Item: ${claim.item_description}`);
    }
    if (claim.item_value) {
      addText(`Value: R ${claim.item_value}`);
    }
    if (claim.purchase_date) {
      addText(`Purchase Date: ${claim.purchase_date}`);
    }
    y += 3;
  }

  if (claim.voice_transcript_en) {
    addText('VOICE STATEMENT', true);
    y += 2;
    const transcript = claim.voice_transcript_en;
    const lines = doc.splitTextToSize(transcript, 170);
    lines.forEach((line: string) => {
      if (y > pageHeight - 20) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, 20, y);
      y += lineHeight;
    });
    y += 3;
  }

  return doc.output('blob');
}

export async function downloadClaimPack(claim: any): Promise<void> {
  const zip = new JSZip();
  const claimRef = claim.id.slice(0, 8);
  const failedFiles: string[] = [];

  // Add PDF report
  const pdfBlob = await generateClaimPDF(claim);
  zip.file(`Claim_${claimRef}.pdf`, pdfBlob);

  // Add voice transcript if exists
  if (claim.voice_transcript) {
    zip.file('voice_transcript.txt', claim.voice_transcript);
  }

  // Helper to extract file extension from URL or blob type
  const getFileExtension = (url: string, blobType?: string): string => {
    // Try URL first
    const urlMatch = url.match(/\.([a-zA-Z0-9]+)(\?|$)/);
    if (urlMatch) return urlMatch[1];

    // Try blob type
    if (blobType) {
      const typeMatch = blobType.match(/\/([a-zA-Z0-9]+)/);
      if (typeMatch) return typeMatch[1];
    }

    return 'file';
  };

  // Collect ALL attachments from multiple sources
  const allAttachments: Array<{url: string, kind?: string, label?: string}> = [];

  // Source 1: attachments array (primary source)
  if (claim.attachments && Array.isArray(claim.attachments)) {
    allAttachments.push(...claim.attachments.filter((att: any) => att?.url));
  }

  // Source 2: documentation array (from claimant_snapshot or claim_data)
  if (claim.documentation && Array.isArray(claim.documentation)) {
    allAttachments.push(...claim.documentation.filter((doc: any) => doc?.url));
  }

  // Source 3: claimant_snapshot.attachments
  if (claim.claimant_snapshot?.attachments && Array.isArray(claim.claimant_snapshot.attachments)) {
    allAttachments.push(...claim.claimant_snapshot.attachments.filter((att: any) => att?.url));
  }

  // Source 4: claim_data.attachments
  if (claim.claim_data?.attachments && Array.isArray(claim.claim_data.attachments)) {
    allAttachments.push(...claim.claim_data.attachments.filter((att: any) => att?.url));
  }

  // Source 5: Legacy URL fields (backwards compatibility)
  const legacyFiles: Array<{url: string, kind: string}> = [];
  if (claim.voice_note_url) legacyFiles.push({url: claim.voice_note_url, kind: 'voice_note'});
  if (claim.driver_license_photo_url) legacyFiles.push({url: claim.driver_license_photo_url, kind: 'driver_license'});
  if (claim.license_disk_photo_url) legacyFiles.push({url: claim.license_disk_photo_url, kind: 'license_disk'});
  if (claim.third_party_license_photo_url) legacyFiles.push({url: claim.third_party_license_photo_url, kind: 'third_party_license'});
  if (claim.third_party_disk_photo_url) legacyFiles.push({url: claim.third_party_disk_photo_url, kind: 'third_party_disk'});
  if (claim.damage_photo_urls) {
    claim.damage_photo_urls.forEach((url: string, idx: number) => {
      legacyFiles.push({url, kind: `damage_photo_${idx + 1}`});
    });
  }
  if (claim.media_urls) {
    claim.media_urls.forEach((url: string, idx: number) => {
      legacyFiles.push({url, kind: `media_${idx + 1}`});
    });
  }

  allAttachments.push(...legacyFiles);

  // Deduplicate by URL
  const uniqueAttachments = Array.from(
    new Map(allAttachments.map(att => [att.url, att])).values()
  );

  console.log(`📦 Downloading ${uniqueAttachments.length} files for claim pack`);

  // Download each attachment
  for (const attachment of uniqueAttachments) {
    try {
      const response = await fetch(attachment.url);
      if (!response.ok) {
        failedFiles.push(attachment.kind || attachment.url);
        continue;
      }

      const blob = await response.blob();
      const extension = getFileExtension(attachment.url, blob.type);

      // Create meaningful filename from kind or label
      const baseName = attachment.kind || attachment.label || 'evidence';
      const sanitizedName = baseName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `${sanitizedName}.${extension}`;

      zip.file(filename, blob);
    } catch (error) {
      console.error(`Failed to download ${attachment.kind || attachment.url}:`, error);
      failedFiles.push(attachment.kind || attachment.url);
    }
  }

  // Add manifest listing any failed downloads
  if (failedFiles.length > 0) {
    const manifest = `Download Pack for Claim ${claimRef}\n` +
                    `Generated: ${new Date().toLocaleString()}\n\n` +
                    `Failed to download the following files:\n` +
                    failedFiles.map(f => `- ${f}`).join('\n');
    zip.file('_manifest.txt', manifest);
  }

  // Generate and download the zip
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Claim_${claimRef}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log(`✅ Download pack created with ${uniqueAttachments.length - failedFiles.length}/${uniqueAttachments.length} files`);
}
