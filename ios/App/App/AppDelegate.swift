import UIKit
import Capacitor
import AVFoundation
import UserNotifications
import VoicetelVtCallService

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // App launch setup
        // Configure audio session for background audio (voice calls)
        do {
            let audioSession = AVAudioSession.sharedInstance()
            try audioSession.setCategory(
                .playAndRecord,
                mode: .voiceChat,
                options: [.allowBluetoothHFP, .allowBluetoothA2DP, .mixWithOthers, .duckOthers, .defaultToSpeaker]
            )
            try audioSession.setActive(true)
        } catch {
            print("AVAudioSession setup failed: \(error)")
        }

		// Configure notifications for incoming call actions
		let center = UNUserNotificationCenter.current()
		center.delegate = self
		let answer = UNNotificationAction(identifier: "ANSWER_CALL", title: "Answer", options: [.foreground])
		let decline = UNNotificationAction(identifier: "DECLINE_CALL", title: "Decline", options: [.destructive])
		let category = UNNotificationCategory(identifier: "INCOMING_CALL", actions: [answer, decline], intentIdentifiers: [], options: [.customDismissAction])
		center.setNotificationCategories([category])
		center.requestAuthorization(options: [.alert, .badge, .sound, .criticalAlert]) { granted, error in
			if let error = error {
				print("Notification authorization error: \(error)")
			} else {
				print("Notification authorization granted: \(granted)")
			}
        }
        
        return true
    }

	// Handle notification action taps (Answer/Decline)
	func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
		let action = response.actionIdentifier
		if action == "ANSWER_CALL" || action == "DECLINE_CALL" {
			DispatchQueue.main.async {
				if let vc = self.window?.rootViewController as? CAPBridgeViewController {
					let js = "if (typeof window !== 'undefined' && typeof window.handleNotificationAction === 'function') { window.handleNotificationAction('" + action + "', null); } else { console.log('handleNotificationAction not available, action: ' + '" + action + "'); }"
					vc.bridge?.webView?.evaluateJavaScript(js, completionHandler: nil)
				}
			}
		}
		completionHandler()
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
