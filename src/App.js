import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView from 'react-native-maps';

export default class App extends React.Component {
  render() {
    return (
      <MapView
        region={{
          latitude: 43.12016,
          longitude: 131.88057,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        }}
        style={styles.map}
      />
    );
  }
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});
