import math

import numpy as np
from math import log


class GridPoint:
    def __init__(self, gridpoint_id, node_id, plate_id, coord_x, coord_y):
        self.id = gridpoint_id
        self.node_id = node_id
        self.plate_id = plate_id
        self.coord_x = coord_x
        self.coord_y = coord_y
        self.displacement = None

    def __str__(self):
        return f'Grid point = {self.id} node_id = {self.node_id} plate_id = {self.plate_id} displacement = {self.displacement}'


class PlateElementV2:
    def __init__(self, grid_point1: GridPoint, grid_point2: GridPoint, E, area1, area2, t1, t2):
        self.grid_point1 = grid_point1
        self.grid_point2 = grid_point2
        self.areas = [area1, area2]
        self.thicknesses = [t1, t2]
        self.length = self.grid_point2.coord_x - self.grid_point1.coord_x
        self.E = E
        # self.W = W
        self.id = (grid_point1.id, grid_point2.id)
        self.stiffness = self.calculate_stiffness()
        self.loads = None
        # self.delta_x = None
        self.end_load = None
        self.stresses = [None, None]
        # self.coord_y = coord_y

    def calculate_stiffness(self) -> float:
        [area1, area2] = self.areas
        if area1 == area2:
            stiffness = self.E * area1 / self.length
        else:
            stiffness = self.E * (area1 - area2) / (self.length * log(area1 / area2))
        return stiffness

    def stiffness_matrix(self):
        stf = self.stiffness
        stf_matrix = np.array([[stf, -stf], [-stf, stf]])
        return stf_matrix

    def calculate_loads(self):
        disp_vector = np.array([self.grid_point1.displacement, self.grid_point2.displacement])
        stf_matrix = self.stiffness_matrix()
        loads = stf_matrix.dot(disp_vector)
        self.loads = loads
        self.end_load = loads[1]
        [area1, area2] = self.areas
        stress1 = self.end_load / area1
        stress2 = self.end_load / area2
        self.stresses = [stress1, stress2]

    def get_stress_at_grid_point_id(self, grid_point_id):
        index = self.id.index(grid_point_id)
        stress = self.stresses[index]
        return stress

    def get_load_at_grid_point_id(self, grid_point_id):
        index = self.id.index(grid_point_id)
        load = self.loads[index]
        return load

    def __str__(self):
        return f'Plate element = {self.id} stiffness = {self.stiffness} end_load = {self.end_load}'


class BearingElementV2:
    def __init__(self, grid_point1: GridPoint, grid_point2: GridPoint, plate_E, fastener_E, plate_thickness, fasteners_qty):
        self.grid_point1 = grid_point1
        self.grid_point2 = grid_point2
        self.plate_E = plate_E
        self.fastener_E = fastener_E
        self.plate_thickness = plate_thickness
        self.fasteners_qty = fasteners_qty
        self.id = (grid_point1.id, grid_point2.id)
        self.stiffness = self.calculate_stiffness()
        # self.delta_x = None
        self.loads = None
        self.end_load = None
        # self.stresses = [None, None]
        # self.coord_y = coord_y

    def calculate_stiffness(self) -> float:
        stiffness = self.fasteners_qty * self.plate_thickness/(1/self.fastener_E + 1/self.plate_E)
        return stiffness

    def stiffness_matrix(self):
        stf = self.stiffness
        stf_matrix = np.array([[stf, -stf], [-stf, stf]])
        return stf_matrix

    def calculate_loads(self):
        disp_vector = np.array([self.grid_point1.displacement, self.grid_point2.displacement])
        stf_matrix = self.stiffness_matrix()
        loads = stf_matrix.dot(disp_vector)
        self.loads = loads
        self.end_load = loads[1]

    def __str__(self):
        return f'Bearing element = {self.id} stiffness = {self.stiffness} loads = {self.loads}'


class FastenerElementV2:
    def __init__(self, grid_point1: GridPoint, grid_point2: GridPoint, fastener_E, fastener_G, thickness1, thickness2,
                 diameter, fasteners_qty):
        self.grid_point1 = grid_point1
        self.grid_point2 = grid_point2
        self.diameter = diameter
        self.fasteners_qty = fasteners_qty
        self.fastener_E = fastener_E
        self.fastener_G = fastener_G
        self.thickness1 = thickness1
        self.thickness2 = thickness2
        self.id = (grid_point1.id, grid_point2.id)
        self.stiffness = self.calculate_stiffness()
        self.loads = None
        self.end_load = None

    def calculate_stiffness(self) -> float:
        length = (self.thickness1 + self.thickness2)/2
        Ib = math.pi * self.diameter **4 / 64
        bending_flexibility = length**3 / (12 * self.fastener_E * Ib)
        area = math.pi * self.diameter **2 / 4
        shear_flexibility = length / (0.9 * self.fastener_G * area)
        stiffness = self.fasteners_qty/(bending_flexibility + shear_flexibility)
        return stiffness

    def stiffness_matrix(self):
        stf = self.stiffness
        stf_matrix = np.array([[stf, -stf], [-stf, stf]])
        return stf_matrix

    def calculate_loads(self):
        disp_vector = np.array([self.grid_point1.displacement, self.grid_point2.displacement])
        stf_matrix = self.stiffness_matrix()
        loads = stf_matrix.dot(disp_vector)
        self.loads = loads
        self.end_load = loads[1]
    def __str__(self):
        return f'Fastener element = {self.id} stiffness = {self.stiffness} load = {self.loads}'