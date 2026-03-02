import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import JSZip from 'jszip';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const getFileExtension = (url: string, contentType?: string): string => {
  const urlPath = new URL(url).pathname;
  const urlExt = urlPath.split('.').pop()?.toLowerCase();

  if (urlExt && ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'mp4', 'webm', 'mov', 'mp3', 'wav', 'ogg'].includes(urlExt)) {
    return urlExt;
  }

  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
  };

  return contentType ? (mimeToExt[contentType] || 'bin') : 'bin';
};

const sanitizeFilename = (name: string): string => {
  return name.replace(/[^a-z0-9_-]/gi, '_').substring(0, 50);
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method not allowed' }),
    };
  }

  try {
    const { claimId } = JSON.parse(event.body || '{}');

    if (!claimId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'claimId is required' }),
      };
    }

    console.log('[DownloadPack] Starting pack creation for claim:', claimId);

    const { data: claim, error: claimError } = await supabase
      .from('claims')
      .select('id, attachments, claim_data, claimant_name, claimant_email, created_at')
      .eq('id', claimId)
      .maybeSingle();

    if (claimError || !claim) {
      console.error('[DownloadPack] Claim not found:', claimError);
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Claim not found' }),
      };
    }

    const zip = new JSZip();
    const failedFiles: Array<{ kind: string; url: string; error: string }> = [];

    const attachments = claim.attachments || [];
    console.log('[DownloadPack] Processing', attachments.length, 'attachments');

    for (let index = 0; index < attachments.length; index++) {
      const attachment = attachments[index];

      if (!attachment.url) {
        console.warn('[DownloadPack] Skipping attachment without URL:', attachment);
        continue;
      }

      try {
        console.log(`[DownloadPack] Downloading ${index + 1}/${attachments.length}:`, attachment.url);

        const response = await fetch(attachment.url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type') || undefined;
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();

        const ext = attachment.path
          ? attachment.path.split('.').pop()?.toLowerCase() || getFileExtension(attachment.url, contentType)
          : getFileExtension(attachment.url, contentType);

        const safeLabel = sanitizeFilename(attachment.label || attachment.kind || `file_${index + 1}`);
        const filename = `evidence/${index + 1}_${attachment.kind}_${safeLabel}.${ext}`;

        zip.file(filename, arrayBuffer);
        console.log('[DownloadPack] Added to zip:', filename);
      } catch (error: any) {
        console.error('[DownloadPack] Failed to download attachment:', error);
        failedFiles.push({
          kind: attachment.kind || 'unknown',
          url: attachment.url,
          error: error.message,
        });
      }
    }

    if (claim.claim_data?.voice_transcript) {
      console.log('[DownloadPack] Adding voice transcript');
      zip.file('transcript.txt', claim.claim_data.voice_transcript);
    }

    if (failedFiles.length > 0) {
      console.warn('[DownloadPack] Some files failed to download:', failedFiles.length);
      const manifest = [
        'DOWNLOAD ERRORS',
        '===============',
        '',
        'The following files could not be included in this pack:',
        '',
        ...failedFiles.map((f, i) =>
          `${i + 1}. ${f.kind}\n   URL: ${f.url}\n   Error: ${f.error}\n`
        ),
      ].join('\n');

      zip.file('manifest.txt', manifest);
    }

    console.log('[DownloadPack] Generating ZIP file');
    const zipBlob = await zip.generateAsync({ type: 'nodebuffer' });

    console.log('[DownloadPack] Pack created successfully, size:', zipBlob.length, 'bytes');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="claim_${claimId}.zip"`,
      },
      body: zipBlob.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (error: any) {
    console.error('[DownloadPack] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: error.message || 'Internal server error',
      }),
    };
  }
};
