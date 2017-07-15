/* global navigator fetch */

import React from 'react';
import { StyleSheet, AppState, View, Text } from 'react-native';
import MapView from 'react-native-maps';
import distance from 'gps-distance';
import BackgroundTimer from 'react-native-background-timer';
import PushNotification from 'react-native-push-notification';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flexGrow: 1,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    padding: 6,
  },
  footerText: {
    backgroundColor: 'white',
    fontSize: 18,
    paddingVertical: 2,
    paddingHorizontal: 5,
  },
  success: { color: '#5cb85c' },
  info: { color: '#5bc0de' },
  warning: { color: '#f0ad4e' },
  danger: { color: '#d9534f' },
});

export default class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      userId: Math.random().toString(),
      users: [],
      region: {
        latitude: 43.10807934723224,
        longitude: 131.91619148879158,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      },
      serverError: false,
      foreground: true,
      overlapsWithOtherUser: false,
    };
    [
      navigator.geolocation.getCurrentPosition,
      navigator.geolocation.watchPosition,
    ].forEach(f =>
      f(this.processPosition.bind(this),
      (...args) => console.log('GPS error:', ...args)));
    BackgroundTimer.setInterval(this.serverSync.bind(this), 2000);
    AppState.addEventListener('change', (nextAppState) => {
      const foreground = nextAppState === 'active';
      if (foreground) PushNotification.cancelAllLocalNotifications();
      this.setState({ foreground });
    });
  }

  processPosition(position) {
    const { latitude, longitude } = position.coords;
    this.setState({ userLocation: { latitude, longitude } });
  }

  async serverSync() {
    const {
      userId,
      userLocation: { latitude, longitude } = {},
      foreground,
      overlapsWithOtherUser,
    } = this.state;
    try {
      const getUrl = methodName =>
        `http://104.236.122.114:4582/${methodName}?userId=${userId}` +
        `&latitude=${latitude}&longitude=${longitude}`;
      if (foreground) {
        const response = await fetch(getUrl('all-users'));
        const users =
          (await response.json())
            .map((p, idx, _points) => ({
              latitude: p[0],
              longitude: p[1],
              distanceToNearestUser:
                Math.round(
                  _points
                    .filter(_p => _p !== p)
                    .reduce(
                      (o, n) => Math.min(o, distance(p[0], p[1], n[0], n[1])),
                      Infinity)
                  * 1000),
            }));
        const currentUser = users.find(user =>
          user.latitude === latitude && user.longitude === longitude);
        this.setState({
          users,
          currentUser,
          overlapsWithOtherUser: currentUser.distanceToNearestUser <= 50,
          serverError: false,
        });
      } else {
        if (!this.state.userLocation) return;
        const response = await fetch(getUrl('distance-to-nearest-user'));
        if (!response.ok) return;
        const d = Math.round(+(await response.text()) * 1000);
        if (d <= 50 && !overlapsWithOtherUser) {
          PushNotification.localNotification({
            id: '0',
            title: 'Слишком близко!',
            message: `${d} метров до ближайшего пользователя`,
          });
        }
        this.setState({ overlapsWithOtherUser: d <= 50 });
      }
    } catch (e) {
      this.setState({ serverError: true });
    }
  }

  render() {
    const { users, currentUser, region, serverError, userLocation } = this.state;
    const dist = currentUser ? currentUser.distanceToNearestUser : Infinity;
    return (
      <View style={styles.container}>
        <MapView
          initialRegion={region}
          style={styles.map}
          onRegionChange={r => this.setState({ region: r })}
          showsUserLocation
          showsMyLocationButton
        >
          {users
            .filter(({ latitude, longitude }) =>
              Math.abs(region.latitude - latitude) <= region.latitudeDelta / 2 &&
              Math.abs(region.longitude - longitude) <= region.longitudeDelta / 2)
            .map((user) => {
              const { latitude, longitude, distanceToNearestUser } = user;
              const overlaps = distanceToNearestUser <= 50;
              return [
                <MapView.Marker
                  key={`Marker.${latitude}.${longitude}`}
                  coordinate={{ latitude, longitude }}
                  pinColor={(user === currentUser && 'blue') || (overlaps && 'red') || 'green'}
                />,
                region.latitudeDelta < 0.003 && <MapView.Circle
                  key={`Circle.${latitude}.${longitude}`}
                  center={{ latitude, longitude }}
                  radius={25}
                  fillColor={overlaps ? 'rgba(192, 57, 43, .3)' : 'rgba(39, 174, 96, .3)'}
                  strokeColor={overlaps ? 'rgba(192, 57, 43, 1.0)' : 'rgba(39, 174, 96, 1.0)'}
                />,
              ];
            })}
        </MapView>
        <View style={styles.footer}>
          {!userLocation && <Text style={[styles.footerText, styles.danger]}>
            Местоположение не определено
          </Text>}
          {dist <= 500 && (
            <Text
              style={[
                styles.footerText,
                styles[(dist <= 50 && 'danger') || (dist <= 60 && 'warning') || 'success'],
              ]}
            >
              Ближайший пользователь на{'\n'}
              расстоянии {dist} метров
            </Text>
          )}
          {serverError && <Text style={[styles.footerText, styles.danger]}>
            Ошибка подключения к серверу
          </Text>}
        </View>
      </View>
    );
  }
}
