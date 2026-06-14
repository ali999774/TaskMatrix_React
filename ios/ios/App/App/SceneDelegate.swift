import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = (scene as? UIWindowScene) else { return }
        let window = UIWindow(windowScene: windowScene)
        window.rootViewController = CAPBridgeViewController()
        self.window = window
        window.makeKeyAndVisible()

        // Cold start via quick action (force-touch app icon while app was killed)
        if let shortcutItem = connectionOptions.shortcutItem {
            handleShortcutItem(shortcutItem)
        }
        // Cold start via deep link (e.g. OAuth callback while app was closed)
        if let urlContext = connectionOptions.urlContexts.first {
            handleOpenURL(urlContext.url)
        }
        if let userActivity = connectionOptions.userActivities.first {
            handleUserActivity(userActivity)
        }
    }

    // Warm start / app already running: taskmatrix://auth/callback lands here.
    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        guard let url = URLContexts.first?.url else { return }
        handleOpenURL(url)
    }

    // Quick action while app is warm (scene-based handler).
    // The AppDelegate.application(_:performActionFor:) also fires on iOS 13+,
    // but this is the canonical scene-scoped handler.
    func windowScene(_ windowScene: UIWindowScene, performActionFor shortcutItem: UIApplicationShortcutItem, completionHandler: @escaping (Bool) -> Void) {
        handleShortcutItem(shortcutItem)
        completionHandler(true)
    }

    // Universal links (https) — not used yet, but correct to route.
    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        handleUserActivity(userActivity)
    }

    // Route through Capacitor's proxy so the bridge fires the JS
    // `appUrlOpen` event (@capacitor/app). A hand-rolled NotificationCenter
    // post does NOT reach the bridge — the notification name and payload
    // shape must match Capacitor's internals, so use the public proxy API.
    private func handleOpenURL(_ url: URL) {
        _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, open: url, options: [:])
    }

    private func handleShortcutItem(_ item: UIApplicationShortcutItem) {
        let path = item.type.replacingOccurrences(of: "com.milestonepediatrics.taskmatrix.", with: "")
        guard let url = URL(string: "taskmatrix://quick-action/\(path)") else { return }
        _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, open: url, options: [:])
    }

    private func handleUserActivity(_ userActivity: NSUserActivity) {
        _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
    }
}
