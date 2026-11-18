package com.gesmak.app.ui.screens

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gesmak.app.R
import kotlinx.coroutines.delay
import kotlin.math.sin

@Composable
fun SplashScreen(onFinished: () -> Unit) {
    var progress by remember { mutableFloatStateOf(0.05f) }

    LaunchedEffect(Unit) {
        val totalMs = 2400L
        val steps = 48
        val stepMs = totalMs / steps
        for (i in 1..steps) {
            delay(stepMs)
            progress = (i.toFloat() / steps.toFloat()).coerceIn(0.05f, 1f)
        }
        delay(120)
        onFinished()
    }

    val inf = rememberInfiniteTransition(label = "splash")
    val spinOuter by inf.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(3200, easing = LinearEasing)),
        label = "spinOuter",
    )
    val spinInner by inf.animateFloat(
        initialValue = 360f,
        targetValue = 0f,
        animationSpec = infiniteRepeatable(tween(4500, easing = LinearEasing)),
        label = "spinInner",
    )
    val pulse by inf.animateFloat(
        initialValue = 0.98f,
        targetValue = 1.04f,
        animationSpec = infiniteRepeatable(tween(1800), RepeatMode.Reverse),
        label = "pulse",
    )
    val floatPhase by inf.animateFloat(
        initialValue = 0f,
        targetValue = (2f * Math.PI).toFloat(),
        animationSpec = infiniteRepeatable(tween(2800, easing = LinearEasing)),
        label = "float",
    )

    val floatDp = (sin(floatPhase.toDouble()) * 5.0).dp

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    listOf(Color(0xFF0F172A), Color(0xFF1E293B), Color(0xFF0B1220)),
                ),
            )
            .systemBarsPadding()
            .padding(20.dp),
    ) {
        // Orbes lumineux
        Box(
            modifier = Modifier
                .size(220.dp)
                .offset(x = (-60).dp, y = 40.dp)
                .clip(CircleShape)
                .background(
                    Brush.radialGradient(
                        listOf(Color(0x552563EB), Color.Transparent),
                    ),
                ),
        )
        Box(
            modifier = Modifier
                .size(190.dp)
                .align(Alignment.BottomEnd)
                .offset(x = 40.dp, y = (-80).dp)
                .clip(CircleShape)
                .background(
                    Brush.radialGradient(
                        listOf(Color(0x44F59E0B), Color.Transparent),
                    ),
                ),
        )

        Column(
            modifier = Modifier.align(Alignment.Center),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Box(
                modifier = Modifier
                    .size(164.dp)
                    .offset(y = floatDp),
                contentAlignment = Alignment.Center,
            ) {
                Canvas(modifier = Modifier.fillMaxSize()) {
                    rotate(spinOuter) {
                        drawArc(
                            brush = Brush.sweepGradient(
                                listOf(Color(0xFF3B82F6), Color(0xFFF59E0B), Color.Transparent, Color.Transparent),
                            ),
                            startAngle = 0f,
                            sweepAngle = 220f,
                            useCenter = false,
                            style = Stroke(width = 6f, cap = StrokeCap.Round),
                        )
                    }
                    rotate(spinInner) {
                        val inset = size.minDimension * 0.06f
                        drawArc(
                            color = Color(0xFFF59E0B).copy(alpha = 0.75f),
                            startAngle = 90f,
                            sweepAngle = 190f,
                            useCenter = false,
                            topLeft = androidx.compose.ui.geometry.Offset(inset, inset),
                            size = androidx.compose.ui.geometry.Size(size.width - inset * 2, size.height - inset * 2),
                            style = Stroke(width = 4.5f, cap = StrokeCap.Round),
                        )
                    }
                }
                Image(
                    painter = painterResource(id = R.drawable.logo_circle),
                    contentDescription = "GESMAK",
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .size(134.dp)
                        .scale(pulse)
                        .clip(CircleShape)
                        .border(2.dp, Color.White.copy(alpha = 0.14f), CircleShape),
                )
            }

            Spacer(Modifier.height(18.dp))

            Text(
                text = buildAnnotatedString {
                    withStyle(SpanStyle(color = Color(0xFF60A5FA), fontWeight = FontWeight.Black)) {
                        append("GES")
                    }
                    withStyle(SpanStyle(color = Color(0xFFFBBF24), fontWeight = FontWeight.Black)) {
                        append("MAK")
                    }
                },
                fontSize = 32.sp,
                letterSpacing = 1.sp,
            )
            Spacer(Modifier.height(4.dp))
            Text(
                text = "Gestion Simplifiée, Business Maîtrisé",
                color = Color(0xFF94A3B8),
                fontSize = 13.sp,
                textAlign = TextAlign.Center,
            )

            Spacer(Modifier.height(22.dp))

            val modules = listOf(
                "📦" to "Stock",
                "🧮" to "Caisse",
                "📈" to "Ventes",
                "💳" to "Dépenses",
                "📄" to "Rapports",
            )
            Row(
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                modules.forEach { (emoji, label) ->
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Box(
                            modifier = Modifier
                                .size(38.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color.White.copy(alpha = 0.06f))
                                .border(1.dp, Color.White.copy(alpha = 0.10f), RoundedCornerShape(12.dp)),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(emoji, fontSize = 16.sp)
                        }
                        Spacer(Modifier.height(4.dp))
                        Text(label, color = Color(0xFF94A3B8), fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
                    }
                }
            }

            Spacer(Modifier.height(28.dp))

            Box(
                modifier = Modifier
                    .width(220.dp)
                    .height(7.dp)
                    .clip(RoundedCornerShape(999.dp))
                    .background(Color.White.copy(alpha = 0.12f)),
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth(progress)
                        .height(7.dp)
                        .clip(RoundedCornerShape(999.dp))
                        .background(
                            Brush.horizontalGradient(
                                listOf(Color(0xFF2563EB), Color(0xFFF59E0B), Color(0xFFFBBF24)),
                            ),
                        ),
                )
            }
            Spacer(Modifier.height(8.dp))
            Text(
                text = if (progress < 0.96f) "Chargement…" else "C’est parti",
                color = Color(0xFF64748B),
                fontSize = 11.sp,
            )
        }

        Text(
            text = "App créée par Akoh Ago Armand Kevin · Kevin Tech Pro",
            color = Color(0xFF475569),
            fontSize = 11.sp,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 8.dp),
        )
    }
}
