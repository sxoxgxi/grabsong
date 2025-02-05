import Gio from "gi://Gio";

const spotifyDbus = `<node>
<interface name="org.mpris.MediaPlayer2.Player">
    <property name="PlaybackStatus" type="s" access="read"/>
    <property name="Metadata" type="a{sv}" access="read"/>
</interface>
</node>`;

export class SpotifyDBus {
  constructor(panelButton) {
    this.proxy = null;
    this.panelButton = panelButton;
    this.initProxy();
  }

  initProxy() {
    try {
      this.proxy = Gio.DBusProxy.new_for_bus_sync(
        Gio.BusType.SESSION,
        Gio.DBusProxyFlags.GET_INVALIDATED_PROPERTIES,
        Gio.DBusInterfaceInfo.new_for_xml(spotifyDbus),
        "org.mpris.MediaPlayer2.spotify",
        "/org/mpris/MediaPlayer2",
        "org.mpris.MediaPlayer2.Player",
        null,
      );

      this.proxy.connect(
        "g-properties-changed",
        (proxy, changed, invalidated) => {
          const props = changed.deepUnpack();
          if ("Metadata" in props) {
            this.panelButton.updateLabel();
          }
        },
      );
    } catch (e) {
      logError(e, "Failed to create DBus proxy");
      this.proxy = null;
    }
  }

  getMetadata() {
    if (!this.proxy || !this.proxy.Metadata) {
      return { title: "", artist: "", url: "", success: false };
    }

    try {
      const metadata = this.proxy.Metadata;
      return {
        title: metadata["xesam:title"] ? metadata["xesam:title"].unpack() : "",
        artist: metadata["xesam:artist"]
          ? metadata["xesam:artist"].get_strv()[0]
          : "",
        url: metadata["xesam:url"] ? metadata["xesam:url"].unpack() : "",
        success: true,
      };
    } catch (e) {
      logError(e, "Failed to extract metadata");
      return { title: "", artist: "", url: "", success: false };
    }
  }

  spotifyIsActive() {
    return this.proxy !== null && this.proxy.Metadata !== null;
  }
}
