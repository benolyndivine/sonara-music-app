package com.sonara.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AudioRouteInfoPlugin.class);
        super.onCreate(savedInstanceState);
    }
}