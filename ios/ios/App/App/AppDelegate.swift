import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Register Home Screen Quick Actions (force-touch / long-press app icon)
        let newTask = UIApplicationShortcutItem(
            type: "com.milestonepediatrics.taskmatrix.new-task",
            localizedTitle: "New Task",
            localizedSubtitle: nil,
            icon: UIApplicationShortcutIcon(systemImageName: "plus.circle"),
            userInfo: nil
        )
        let newNote = UIApplicationShortcutItem(
            type: "com.milestonepediatrics.taskmatrix.new-note",
            localizedTitle: "New Note",
            localizedSubtitle: nil,
            icon: UIApplicationShortcutIcon(systemImageName: "note.text.badge.plus"),
            userInfo: nil
        )
        application.shortcutItems = [newTask, newNote]
        return true
    }

    // Warm start: app already running, user taps a quick action.
    func application(_ application: UIApplication, performActionFor shortcutItem: UIApplicationShortcutItem, completionHandler: @escaping (Bool) -> Void) {
        handleShortcutItem(shortcutItem)
        completionHandler(true)
    }

    private func handleShortcutItem(_ item: UIApplicationShortcutItem) {
        let path = item.type.replacingOccurrences(of: "com.milestonepediatrics.taskmatrix.", with: "")
        guard let url = URL(string: "taskmatrix://quick-action/\(path)") else { return }
        _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, open: url, options: [:])
    }

    func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        return UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    }
}
