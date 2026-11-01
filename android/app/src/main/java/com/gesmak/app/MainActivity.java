package com.gesmak.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    // Thème déjà appliqué via Manifest — pas de SplashScreen API obligatoire
    super.onCreate(savedInstanceState);
  }
}
