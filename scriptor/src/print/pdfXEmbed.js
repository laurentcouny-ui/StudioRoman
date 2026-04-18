/**
 * Embarque OutputIntent (ICC) + flux XMP dans le catalogue PDF pour un rapprochement PDF/X.
 * ICC : voir `iccBundledProfiles.js` (MIT, Compact-ICC-Profiles).
 */
import { PDFName, PDFString } from 'pdf-lib'
import { resolveBundledIcc } from './iccBundledProfiles'

function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function iso8601Basic(d) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}Z`
}

function buildPdfxXmpUtf8({ pdfStandard, title, author, isbn }) {
  const vers = pdfStandard === 'PDF/X-1a' ? 'PDF/X-1a:2001' : 'PDF/X-4:2010'
  const conf = pdfStandard === 'PDF/X-1a' ? 'PDF/X-1a' : 'PDF/X-4'
  const now = iso8601Basic(new Date())
  const xt = xmlEscape(title || '')
  const xa = xmlEscape(author || '')
  const xi = xmlEscape(isbn || '')
  const xml = `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
        xmlns:pdf="http://ns.adobe.com/pdf/1.3/"
        xmlns:dc="http://purl.org/dc/elements/1.1/"
        xmlns:xmp="http://ns.adobe.com/xap/1.0/"
        xmlns:pdfxid="http://www.npes.org/pdfx/ns/id/"
        pdf:Producer="Scriptor Desktop V2"
        pdfxid:GTS_PDFXVersion="${vers}"
        pdfxid:GTS_PDFXConformance="${conf}"
        xmp:MetadataDate="${now}"
        xmp:CreateDate="${now}">
      <dc:title>
        <rdf:Alt>
          <rdf:li xml:lang="x-default">${xt}</rdf:li>
        </rdf:Alt>
      </dc:title>
      <dc:creator>
        <rdf:Seq>
          <rdf:li>${xa}</rdf:li>
        </rdf:Seq>
      </dc:creator>
      ${xi ? `<dc:identifier><rdf:Bag><rdf:li>urn:isbn:${xi}</rdf:li></rdf:Bag></dc:identifier>` : ''}
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`
  return new TextEncoder().encode(xml)
}

/**
 * @param {import('pdf-lib').PDFDocument} doc
 * @param {{
 *   outputIntentProfileLabel: string,
 *   pdfStandard: string,
 *   title?: string,
 *   author?: string,
 *   isbn?: string,
 *   iccBundle?: ReturnType<typeof resolveBundledIcc>,
 * }} opts
 */
export function embedPdfPrintOutputIntentAndXmp(doc, opts) {
  const ctx = doc.context
  const catalog = doc.catalog
  const profileLabel = (opts.outputIntentProfileLabel || 'GRACoL').slice(0, 128)
  const pdfStandard = opts.pdfStandard === 'PDF/X-1a' ? 'PDF/X-1a' : 'PDF/X-4'

  const bundle = opts.iccBundle ?? resolveBundledIcc(profileLabel)
  const { bytes: iccBytes, streamDict, technicalId } = bundle
  const iccStream = ctx.stream(iccBytes, streamDict)
  const iccRef = ctx.register(iccStream)

  const oi = ctx.obj({
    Type: 'OutputIntent',
    S: 'GTS_PDFX',
  })
  oi.set(PDFName.of('OutputConditionIdentifier'), PDFString.of(profileLabel))
  oi.set(PDFName.of('RegistryName'), PDFString.of('http://www.color.org'))
  oi.set(
    PDFName.of('Info'),
    PDFString.of(`${technicalId}; etiquette metier: ${profileLabel}`.slice(0, 250)),
  )
  oi.set(PDFName.of('DestOutputProfile'), iccRef)

  const oiRef = ctx.register(oi)
  catalog.set(PDFName.of('OutputIntents'), ctx.obj([oiRef]))

  const xmpBytes = buildPdfxXmpUtf8({
    pdfStandard,
    title: opts.title,
    author: opts.author,
    isbn: opts.isbn,
  })
  const metaStream = ctx.stream(xmpBytes, { Type: 'Metadata', Subtype: 'XML' })
  const metaRef = ctx.register(metaStream)
  catalog.set(PDFName.of('Metadata'), metaRef)
}
