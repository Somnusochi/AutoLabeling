"""Minimal decord stub so transformers doesn't fail on ``import decord``.

decord is a Linux-only video reader that is not needed by LocateAnything-3B
(image-based model), but the transformers processor still attempts to import it.
"""


class VideoReader:
    def __init__(self, *args, **kwargs):
        pass

    def __len__(self):
        return 0


class cpu:  # noqa: N801 - match decord's public API
    pass


class gpu:  # noqa: N801 - match decord's public API
    pass


class bridge:  # noqa: N801 - match decord's public API
    @staticmethod
    def set_bridge(x):
        pass
