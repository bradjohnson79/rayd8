import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface AboutModalProps {
  visible: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ visible, onClose }) => {
  if (!visible) return null;

  return (
    <View style={[StyleSheet.absoluteFill, styles.centeredView]}>
      <View style={styles.modalView}>
        <TouchableOpacity
          style={styles.closeIcon}
          onPress={onClose}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={24} color="white" />
        </TouchableOpacity>
        <ScrollView
          style={{ width: "100%", flexGrow: 0 }}
          contentContainerStyle={styles.modalContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.modalTitle}>
            About Hamsa – Virtual Healing Hand
          </Text>

          <Text style={styles.modalText}>
            Hamsa is a visual and audio wellness experience designed to support
            calm, balance, and personal rejuvenation. The app works by
            presenting a living field of light, color, sound, and symbolic form
            that flows in gentle, repeating cycles.
          </Text>

          <Text style={styles.modalText}>
            To use this app, simply select the speed of your choosing, and the
            mode: Physical, Energy or both. Watch the screen as your sequence
            plays and be aware of any subtle changes happening within you. This
            is the internal rejuvenation effect that works with the cells of
            your body. Hamsa works to reduce stress, detoxify strain and promote
            wellness overall aiding you in moving into deeper brainwave states:
            Alpha, Theta and Delta. DIfferent effects happen through different
            speeds, so encourage yourself to experiment to determine what feels
            right for you as you use Hamsa.
          </Text>

          <Text style={styles.modalText}>
            At the core of Hamsa is the use of transcendental frequencies and
            imbued scalar wave effects, expressed through carefully designed
            glyphs, color fields, animated geometry, and ambient sound. Each of
            these elements is intentionally arranged, synchronized and imbued in
            deeper states by the app&apos;s creator to create a coherent living
            energetic environment rather than a static image or simple
            animation.
          </Text>

          <Text style={styles.modalText}>
            The glyphs you see are symbolic representations encoded with
            specific frequency intentions. As they shift over time, the
            surrounding colors, light patterns, and motion transition with them,
            forming a unified visual state. These transitions are slow, smooth,
            and rhythmic, allowing the system to remain calming rather than
            stimulating.
          </Text>

          <Text style={styles.modalText}>
            The combination of visuals, color harmonics, subtle motion, and
            sound is intended to support relaxation, focus, and a sense of
            internal balance. Hamsa does not require effort, belief, or
            interaction beyond presence. It is meant to be experienced
            passively, allowing the user to rest, breathe, and observe.
          </Text>

          <Text style={styles.modalText}>
            Hamsa is not a medical device and does not diagnose or treat
            conditions. It is a personal wellness tool designed to support
            moments of stillness, reflection, and energetic alignment in a
            fast-moving world.
          </Text>
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: "5%",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    zIndex: 9999, // Ensure it sits on top of everything
    elevation: 100, // For Android
  },
  modalView: {
    margin: 20,
    backgroundColor: "rgba(30, 30, 50, 0.95)",
    borderRadius: 20,
    padding: 25,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.5)",
    width: "90%",
    maxHeight: "90%",
    position: "relative",
  },
  closeIcon: {
    position: "absolute",
    top: 15,
    right: 15,
    zIndex: 10,
    padding: 5,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 20,
  },
  modalContent: {
    alignItems: "center",
    paddingBottom: 20,
    paddingTop: 10,
  },
  modalTitle: {
    fontSize: 26,
    color: "white",
    marginBottom: 20,
    textAlign: "center",
    fontFamily: "EBGaramond-Bold",
  },
  modalText: {
    color: "#e2e8f0",
    fontSize: 18,
    marginBottom: 15,
    marginHorizontal: 30,
    textAlign: "justify",
    lineHeight: 24,
    fontFamily: "EBGaramond-Regular",
  },
});
