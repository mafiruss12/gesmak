package com.gesmak.app.data

import android.content.Context
import android.content.Intent
import android.print.PrintAttributes
import android.print.PrintManager
import android.webkit.WebView
import android.webkit.WebViewClient
import java.text.NumberFormat
import java.util.Locale

object ReceiptPrinter {
    data class ReceiptLine(
        val name: String,
        val qty: Int,
        val unitPrice: Double,
        val note: String? = null,
    )

    data class PrintableReceipt(
        val id: String,
        val title: String,
        val establishmentName: String,
        val establishmentPhone: String? = null,
        val establishmentAddress: String? = null,
        val serviceLabel: String? = null,
        val customerName: String? = null,
        val serverName: String? = null,
        val dateLabel: String,
        val statusLabel: String,
        val paymentLabel: String? = null,
        val total: Double,
        val paidAmount: Double? = null,
        val notes: String? = null,
        val lines: List<ReceiptLine>,
    )

    private fun fcfa(v: Double): String {
        val fmt = NumberFormat.getIntegerInstance(Locale.FRANCE)
        return "${fmt.format(v.toLong())} F"
    }

    private fun escHtml(raw: String): String =
        raw.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("\"", "&quot;")

    fun formatPlainText(r: PrintableReceipt): String = buildString {
        appendLine("=== ${r.establishmentName.uppercase(Locale.FRANCE)} ===")
        if (!r.establishmentAddress.isNullOrBlank()) appendLine(r.establishmentAddress)
        if (!r.establishmentPhone.isNullOrBlank()) appendLine("Tél : ${r.establishmentPhone}")
        appendLine("${r.title} #${r.id.take(8).uppercase(Locale.FRANCE)}")
        appendLine("Date : ${r.dateLabel}")
        if (!r.serviceLabel.isNullOrBlank()) appendLine("Service : ${r.serviceLabel}")
        if (!r.customerName.isNullOrBlank()) appendLine("Client : ${r.customerName}")
        if (!r.serverName.isNullOrBlank()) appendLine("Agent : ${r.serverName}")
        appendLine("--------------------------------")
        for (line in r.lines) {
            appendLine("${line.qty}x ${line.name}  —  ${fcfa(line.qty * line.unitPrice)}")
        }
        appendLine("--------------------------------")
        appendLine("TOTAL : ${fcfa(r.total)}")
        if (r.paidAmount != null && r.paidAmount > 0) {
            appendLine("PAYÉ : ${fcfa(r.paidAmount)}")
        }
        if (!r.paymentLabel.isNullOrBlank()) appendLine("Règlement : ${r.paymentLabel}")
        appendLine("Statut : ${r.statusLabel}")
        if (!r.notes.isNullOrBlank()) appendLine("Note : ${r.notes}")
        append("Merci pour votre visite !")
    }

    fun shareTextReceipt(context: Context, r: PrintableReceipt) {
        val text = formatPlainText(r)
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_SUBJECT, "Reçu ${r.establishmentName} #${r.id.take(6).uppercase(Locale.FRANCE)}")
            putExtra(Intent.EXTRA_TEXT, text)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(Intent.createChooser(intent, "Partager / Envoyer le reçu").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    fun printHtmlReceipt(context: Context, r: PrintableReceipt) {
        val rowsHtml = r.lines.joinToString("") { line ->
            val sub = line.qty * line.unitPrice
            val notePart = if (!line.note.isNullOrBlank()) "<div class=\"muted\">${escHtml(line.note)}</div>" else ""
            """
            <tr>
              <td><strong>${line.qty}×</strong> ${escHtml(line.name)}$notePart</td>
              <td class="num">${escHtml(fcfa(sub))}</td>
            </tr>
            """.trimIndent()
        }
        val html = """
            <!doctype html>
            <html lang="fr">
            <head>
              <meta charset="utf-8" />
              <style>
                @page { margin: 8mm; }
                body { font-family: monospace; color: #111; font-size: 12px; margin: 0; padding: 8px; max-width: 320px; }
                .center { text-align: center; }
                .muted { color: #555; font-size: 11px; }
                .sep { border-top: 1px dashed #999; margin: 8px 0; }
                table { width: 100%; border-collapse: collapse; }
                td { padding: 3px 0; vertical-align: top; }
                .num { text-align: right; white-space: nowrap; font-weight: bold; }
                .total { font-size: 15px; font-weight: 800; }
              </style>
            </head>
            <body>
              <div class="center">
                <div style="font-size:15px;font-weight:800;">${escHtml(r.establishmentName.uppercase(Locale.FRANCE))}</div>
                ${if (!r.establishmentAddress.isNullOrBlank()) "<div class=\"muted\">${escHtml(r.establishmentAddress)}</div>" else ""}
                ${if (!r.establishmentPhone.isNullOrBlank()) "<div class=\"muted\">Tél : ${escHtml(r.establishmentPhone)}</div>" else ""}
                <div style="margin-top:6px;font-weight:bold;">${escHtml(r.title)} #${escHtml(r.id.take(8).uppercase(Locale.FRANCE))}</div>
              </div>
              <div class="sep"></div>
              <div class="muted">Date : ${escHtml(r.dateLabel)}</div>
              ${if (!r.serviceLabel.isNullOrBlank()) "<div><strong>Service :</strong> ${escHtml(r.serviceLabel)}</div>" else ""}
              ${if (!r.customerName.isNullOrBlank()) "<div><strong>Client :</strong> ${escHtml(r.customerName)}</div>" else ""}
              ${if (!r.serverName.isNullOrBlank()) "<div class=\"muted\">Agent : ${escHtml(r.serverName)}</div>" else ""}
              <div class="sep"></div>
              <table>$rowsHtml</table>
              <div class="sep"></div>
              <table>
                <tr class="total"><td>TOTAL</td><td class="num">${escHtml(fcfa(r.total))}</td></tr>
                ${if (r.paidAmount != null && r.paidAmount > 0) "<tr><td>Payé</td><td class=\"num\">${escHtml(fcfa(r.paidAmount))}</td></tr>" else ""}
              </table>
              ${if (!r.paymentLabel.isNullOrBlank()) "<div class=\"muted\">Règlement : ${escHtml(r.paymentLabel)}</div>" else ""}
              <div><strong>Statut :</strong> ${escHtml(r.statusLabel)}</div>
              ${if (!r.notes.isNullOrBlank()) "<div class=\"muted\" style=\"margin-top:4px;\">Note : ${escHtml(r.notes)}</div>" else ""}
              <div class="sep"></div>
              <div class="center muted">Merci pour votre confiance !<br/>Ticket généré par GESMAK</div>
            </body>
            </html>
        """.trimIndent()

        val webView = WebView(context)
        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                val printManager = context.getSystemService(Context.PRINT_SERVICE) as? PrintManager ?: return
                val jobName = "GESMAK_${r.id.take(6).uppercase(Locale.FRANCE)}"
                val adapter = webView.createPrintDocumentAdapter(jobName)
                printManager.print(jobName, adapter, PrintAttributes.Builder().build())
            }
        }
        webView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null)
    }
}
