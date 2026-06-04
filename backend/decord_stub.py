"""Minimal decord stub so transformers doesn't fail on ``import decord``.

decord is a Linux-only video reader that is not needed by LocateAnything-3B
(image-based model), but the transformers processor still attempts to import it.
"""


class VideoReader:
    def __init__(self, *args, **kwargs):
        pass

    def __len__(self):
        return 0


class cpu:
    pass


class gpu:
    pass


class bridge:
    @staticmethod
    def set_bridge(x):
        pass
