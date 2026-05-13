import L from "leaflet";

type PatchedMapPrototype = typeof L.Map.prototype & {
  _pd24SafeRemovePatched?: boolean;
};

type PatchedLayerPrototype = typeof L.Layer.prototype & {
  _layerAdd?: (this: L.Layer, event: { target?: L.Map }) => void;
  _pd24SafeLayerAddPatched?: boolean;
};

type LeafletContainer = HTMLElement & {
  _leaflet_id?: number;
};

type LeafletMapInternals = L.Map & {
  _panes?: Partial<Record<string, HTMLElement>>;
};

function warnInDevelopment(message: string, error: unknown) {
  if (process.env.NODE_ENV !== "production") {
    console.warn(message, error);
  }
}

function isRecoverableLeafletTeardownError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  return (
    message.includes("appendChild") ||
    message.includes("_leaflet_pos") ||
    message.includes("Map container is already initialized") ||
    message.includes("Map container is being reused")
  );
}

function getMapContainer(map: L.Map) {
  try {
    return map.getContainer() as LeafletContainer;
  } catch {
    return null;
  }
}

function isMapReadyForLayerAdd(map: L.Map | undefined) {
  if (!map) return false;

  const container = getMapContainer(map);
  const panes = (map as LeafletMapInternals)._panes;

  return Boolean(container?.isConnected && panes?.mapPane);
}

export function patchLeafletMapRemove() {
  const prototype = L.Map.prototype as PatchedMapPrototype;
  const layerPrototype = L.Layer.prototype as PatchedLayerPrototype;

  if (!prototype._pd24SafeRemovePatched) {
    const originalRemove = prototype.remove;

    prototype.remove = function safeRemove(this: L.Map) {
      const container = getMapContainer(this);

      try {
        return originalRemove.call(this);
      } catch (error) {
        if (!isRecoverableLeafletTeardownError(error)) {
          throw error;
        }

        if (container) {
          delete container._leaflet_id;
        }

        warnInDevelopment("Leaflet map cleanup recovered:", error);

        return this;
      }
    };

    prototype._pd24SafeRemovePatched = true;
  }

  if (layerPrototype._pd24SafeLayerAddPatched || !layerPrototype._layerAdd) return;

  const originalLayerAdd = layerPrototype._layerAdd;

  layerPrototype._layerAdd = function safeLayerAdd(this: L.Layer, event: { target?: L.Map }) {
    if (!isMapReadyForLayerAdd(event.target)) {
      return;
    }

    try {
      originalLayerAdd.call(this, event);
    } catch (error) {
      if (!isRecoverableLeafletTeardownError(error)) {
        throw error;
      }

      warnInDevelopment("Leaflet layer mount recovered:", error);
    }
  };

  layerPrototype._pd24SafeLayerAddPatched = true;
}
