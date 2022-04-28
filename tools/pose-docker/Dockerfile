FROM debian:buster

RUN dpkg --add-architecture i386 && \
    apt-get update && \
    apt-get install -y \
        cpio rpm2cpio \
        libgcc1:i386 libstdc++6:i386 \
        libxext6:i386

COPY *.rpm /tmp/
RUN for rpm_file in /tmp/*.rpm; do \
        rpm2cpio $rpm_file | cpio -idmv; \
    done

COPY ROMs /opt/ROMs
WORKDIR /opt

CMD ["pose"]

