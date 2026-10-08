package br.com.emtech.hexadrop;

import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // A cena vai de borda a borda, por baixo do notch e da barra de gestos;
        // o HUD e a camera descem com o safe-area (--safe-area-inset-*, que o
        // SystemBars do Capacitor injeta com insetsHandling "css").
        //
        // DEPOIS do super.onCreate: o BridgeActivity troca o tema da abertura
        // (com ActionBar) pelo AppTheme.NoActionBar ali dentro, e o EdgeToEdge
        // cria a janela na hora. Chamado antes, a janela nascia com a ActionBar
        // "Hexa Drop" por cima do HUD.
        EdgeToEdge.enable(this);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            getWindow().getAttributes().layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }
        // O HUD tem medidas fixas: o tamanho de fonte do sistema no maximo
        // estourava os cartoes e a fileira de cima.
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().getSettings().setTextZoom(100);
        }
    }
}
