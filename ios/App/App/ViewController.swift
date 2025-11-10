import UIKit
import Capacitor

class ViewController: CAPBridgeViewController {

    override func viewDidLoad() {
        super.viewDidLoad()

        print("🔧 ViewController: viewDidLoad called")
        print("🔧 Registering CallServicePlugin manually...")

        // Manually register the CallServicePlugin
        if let bridge = self.bridge {
            bridge.registerPluginInstance(CallServicePlugin())
            print("✅ CallServicePlugin registered successfully with bridge")
        } else {
            print("❌ Bridge is nil, cannot register CallServicePlugin")
        }
    }

    override open func capacitorDidLoad() {
        super.capacitorDidLoad()

        print("🔧 capacitorDidLoad called")

        // Double-check registration
        if let bridge = self.bridge {
            bridge.registerPluginInstance(CallServicePlugin())
            print("✅ CallServicePlugin re-registered in capacitorDidLoad")
        }
    }
}
